import { readWizardEnv, type EnvRecord } from './core/env';

/**
 * 로깅 설정.
 * - 레벨: env `MYSQL2_WIZARD_LOG_LEVEL` (silent | error | warn | info | debug). 기본 info.
 *   하위 호환: 레벨 미설정이고 `DEBUG=true`(정확히 "true")면 debug. 다른 패키지와 겹치는 이름이라 명시 설정을 권장.
 * - 출력: 기본 console. `configureLogging({ logger })`로 교체 가능 (pino/winston 등).
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  /** info 레벨 (printQuery 등) */
  log: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
}

export interface LoggingOptions {
  level?: LogLevel;
  /** 일부만 넘기면 나머지는 console을 쓴다 */
  logger?: Partial<Logger>;
  /** 메시지 접두사. 기본 `[MySQL2 Wizard] ` */
  prefix?: string;
}

const LEVEL_ORDER: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const LEVELS = Object.keys(LEVEL_ORDER) as LogLevel[];

const isLogLevel = (value: string | undefined): value is LogLevel =>
  value !== undefined && (LEVELS as string[]).includes(value);

export const levelFromEnv = (env: EnvRecord = process.env): LogLevel => {
  const raw = readWizardEnv(env, 'LOG_LEVEL')?.value.trim().toLowerCase();
  if (isLogLevel(raw)) return raw;
  return env.DEBUG === 'true' ? 'debug' : 'info';
};

const consoleLogger: Logger = {
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  warn: (message) => console.warn(message),
  debug: (message) => console.debug(message),
};

const state: { level: LogLevel; sink: Logger; prefix: string } = {
  level: levelFromEnv(),
  sink: consoleLogger,
  prefix: '[MySQL2 Wizard] ',
};

/** 런타임에 로깅 레벨/출력/접두사를 바꾼다. 넘기지 않은 항목은 유지. */
export function configureLogging(options: LoggingOptions): void {
  if (options.level !== undefined) state.level = options.level;
  if (options.logger !== undefined) state.sink = { ...consoleLogger, ...options.logger };
  if (options.prefix !== undefined) state.prefix = options.prefix;
}

export const getLogLevel = (): LogLevel => state.level;

export const isLogEnabled = (level: Exclude<LogLevel, 'silent'>): boolean =>
  LEVEL_ORDER[state.level] >= LEVEL_ORDER[level];

const emit = (level: Exclude<LogLevel, 'silent'>, method: keyof Logger, message: string): void => {
  if (!isLogEnabled(level)) return;
  state.sink[method](state.prefix + message);
};

/** 내부 로거. 레벨 필터 후 설정된 sink로 보낸다. */
export const logger: Logger = {
  log: (message) => emit('info', 'log', message),
  error: (message) => emit('error', 'error', message),
  warn: (message) => emit('warn', 'warn', message),
  debug: (message) => emit('debug', 'debug', message),
};
