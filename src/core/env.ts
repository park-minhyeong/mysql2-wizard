import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ConnectionOptions, PoolOptions, SslOptions } from "mysql2";

// mysql2가 typeCast 콜백 타입을 루트에서 export하지 않으므로 옵션 타입에서 유도한다
type TypeCastFn = Extract<NonNullable<ConnectionOptions["typeCast"]>, (...args: never[]) => unknown>;
export type TypeCastField = Parameters<TypeCastFn>[0];
export type TypeCastNext = Parameters<TypeCastFn>[1];

/** URL 쿼리 문자열에는 쉘이 개입하지 않아 `~`가 홈으로 확장되지 않는다. */
function resolveSslFilePath(filePath: string): string {
  let expanded = filePath;
  if (filePath === "~") {
    expanded = os.homedir();
  } else if (filePath.startsWith("~/")) {
    expanded = path.join(os.homedir(), filePath.slice(2));
  }
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(process.cwd(), expanded);
}

export interface ParsedDatabaseUrl {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  ssl?: SslOptions;
  connectTimeoutMs?: number;
}

/** 환경 변수 `DB_URL`(Prisma 스타일 `mysql://...?sslca=...&sslaccept=...`)을 mysql2 옵션으로 파싱합니다. */
export function parseMysqlDatabaseUrl(databaseUrl: string): ParsedDatabaseUrl {
  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new Error("DB_URL is not a valid URL");
  }

  const protocol = u.protocol.replace(/:$/, "");
  if (protocol !== "mysql" && protocol !== "mysql2") {
    throw new Error(`DB_URL protocol must be mysql: or mysql2:, got "${u.protocol}"`);
  }

  const host = u.hostname || "localhost";
  const port = u.port ? Number(u.port) : 3306;
  const user = decodeURIComponent(u.username.replace(/\+/g, " "));
  const password = decodeURIComponent(u.password.replace(/\+/g, " "));
  const pathPart = u.pathname.replace(/^\//, "");
  const database = pathPart.length > 0 ? decodeURIComponent(pathPart) : undefined;

  const params = u.searchParams;
  const sslca = params.get("sslca") ?? params.get("sslrootcert");
  const sslcert = params.get("sslcert");
  const sslkey = params.get("sslkey");
  const sslaccept = params.get("sslaccept");

  const ssl: SslOptions = {};
  let hasSslFiles = false;
  try {
    if (sslca) {
      ssl.ca = fs.readFileSync(resolveSslFilePath(sslca));
      hasSslFiles = true;
    }
    if (sslcert) {
      ssl.cert = fs.readFileSync(resolveSslFilePath(sslcert));
      hasSslFiles = true;
    }
    if (sslkey) {
      ssl.key = fs.readFileSync(resolveSslFilePath(sslkey));
      hasSslFiles = true;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`DB_URL SSL file could not be read: ${msg}`);
  }

  let sslOption: SslOptions | undefined;
  if (hasSslFiles || sslaccept) {
    if (sslaccept === "strict") {
      ssl.rejectUnauthorized = true;
    } else if (sslaccept === "accept_invalid_certs") {
      ssl.rejectUnauthorized = false;
    } else if (hasSslFiles) {
      ssl.rejectUnauthorized = true;
    } else {
      ssl.rejectUnauthorized = false;
    }
    sslOption = ssl;
  }

  const connectTimeoutRaw = params.get("connect_timeout");
  let connectTimeoutMs: number | undefined;
  if (connectTimeoutRaw !== null && connectTimeoutRaw !== "") {
    const sec = Number(connectTimeoutRaw);
    if (Number.isNaN(sec) || sec < 0) {
      throw new Error(`DB_URL connect_timeout must be a non-negative number, got "${connectTimeoutRaw}"`);
    }
    connectTimeoutMs = sec * 1000;
  }

  return { host, port, user, password, database, ssl: sslOption, connectTimeoutMs };
}

export type EnvRecord = Record<string, string | undefined>;

/**
 * 환경 변수 원칙
 * - 접속(mysql2 pool 옵션)에 필요한 값은 `DB_*`
 * - 이 라이브러리 고유 동작은 `MYSQL2_WIZARD_*` (다른 패키지의 `DEBUG`, `CASTED_BOOLEAN` 같은 일반 이름과 충돌 방지)
 * - 예전 이름(`CASTED_BOOLEAN`, `DB_CONNECTION_RETRY_COUNT` 등)은 fallback으로 계속 읽는다. 둘 다 있으면 `MYSQL2_WIZARD_*` 우선.
 */
export const WIZARD_ENV_PREFIX = "MYSQL2_WIZARD_";

/** 라이브러리 고유 옵션 → (우선) `MYSQL2_WIZARD_<name>`, (fallback) 예전 키들 */
export const WIZARD_ENV_KEYS = {
  LOG_LEVEL: [],
  CASTED_BOOLEAN: ["CASTED_BOOLEAN"],
  ENABLE_MARIADB_JSON: ["ENABLE_MARIADB_JSON"],
  CASTED_DECIMAL_AS_NUMBER: ["CASTED_DECIMAL_AS_NUMBER"],
} as const satisfies Record<string, readonly string[]>;

export type WizardEnvName = keyof typeof WIZARD_ENV_KEYS;

/** `MYSQL2_WIZARD_<name>` → 예전 키 순으로 처음 정의된 값. 어느 키에서 읽었는지도 돌려준다. */
export const readWizardEnv = (record: EnvRecord, name: WizardEnvName): { key: string; value: string } | undefined => {
  const candidates = [WIZARD_ENV_PREFIX + name, ...WIZARD_ENV_KEYS[name]];
  for (const key of candidates) {
    const value = record[key];
    if (value !== undefined) return { key, value };
  }
  return undefined;
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
};

const parseNumber = (key: string, value: string | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  const number = Number(value);
  if (isNaN(number)) throw new Error(`Invalid number value for ${key}: ${value}`);
  return number;
};

const readBooleanEnv = (record: EnvRecord, key: string, defaultValue: boolean): boolean =>
  parseBoolean(record[key], defaultValue);

const readNumberEnv = (record: EnvRecord, key: string, defaultValue: number): number =>
  parseNumber(key, record[key], defaultValue);

const readStringEnv = (record: EnvRecord, key: string, defaultValue: string): string => {
  const value = record[key];
  if (value === undefined) return defaultValue;
  return value;
};

const readWizardBoolean = (record: EnvRecord, name: WizardEnvName, defaultValue: boolean): boolean =>
  parseBoolean(readWizardEnv(record, name)?.value, defaultValue);

export interface TypeCastFlags {
  castedBoolean: boolean;
  enableMariaDbJson: boolean;
  castedDecimalAsNumber: boolean;
}

const DECIMAL_TYPES: ReadonlyArray<TypeCastField["type"]> = ["DECIMAL", "NEWDECIMAL", "FLOAT", "DOUBLE"];

/** mysql2 `typeCast` 훅: TINY(1)→boolean, MariaDB JSON 파싱, DECIMAL→number (각각 env 플래그로 제어). */
export const createTypeCast = (flags: TypeCastFlags) => (field: TypeCastField, next: TypeCastNext): unknown => {
  if (field.type === "TINY" && field.length === 1 && flags.castedBoolean) {
    return field.string() === "1";
  }

  if (flags.enableMariaDbJson && (field.type === "JSON" || field.type === "BLOB")) {
    const value = field.string();
    if (value === null || value === undefined) return null;
    try {
      return JSON.parse(value);
    } catch {
      // JSON 파싱 실패 시 원본 문자열 반환
      return value;
    }
  }

  if (flags.castedDecimalAsNumber && DECIMAL_TYPES.includes(field.type)) {
    const value = field.string();
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }

  return next();
};

/**
 * 항상 켜져 있는 동작 (env 없음). 대부분의 경우 이로운 기능은 설정 항목으로 노출하지 않는다.
 * - keep-alive, 빌릴 때 ping, "Too many connections"/"Connection lost" 지수 백오프 재시도
 * - idle 정리는 mysql2 기본값(idleTimeout 60s, maxIdle = connectionLimit)
 */
export const CONNECTION_RETRY_COUNT = 3;
export const CONNECTION_RETRY_DELAY_MS = 1000;

/** 2.1.0에서 설정 항목에서 제외된 키. 설정돼 있으면 기동 시 한 번 알린다. */
export const REMOVED_ENV_KEYS = [
  "DB_ENABLE_RECONNECT",
  "DB_IDLE_TIMEOUT",
  "DB_ENABLE_KEEP_ALIVE",
  "DB_CONNECTION_RETRY_COUNT",
  "DB_CONNECTION_RETRY_DELAY",
  "DB_CONVERT_DATE_TO_UTC",
] as const;

export const findRemovedEnvKeys = (env: EnvRecord = process.env): string[] =>
  REMOVED_ENV_KEYS.filter((key) => env[key] !== undefined);

export interface PoolRuntimeConfig {
  mysql2Options: PoolOptions;
  dbType: string;
}

export const readEnv = (env: EnvRecord = process.env): PoolRuntimeConfig => {
  const databaseUrl = env.DB_URL?.trim();
  const parsedUrl = databaseUrl ? parseMysqlDatabaseUrl(databaseUrl) : null;

  const host = parsedUrl?.host ?? readStringEnv(env, "DB_HOST", "localhost");
  const user = parsedUrl?.user ?? readStringEnv(env, "DB_USER", "root");
  const password = parsedUrl?.password ?? readStringEnv(env, "DB_PASSWORD", "");
  const database = parsedUrl?.database ?? env.DB_NAME;
  const port = parsedUrl?.port ?? readNumberEnv(env, "DB_PORT", 3306);
  const connectionLimit = readNumberEnv(env, "DB_CONNECTION_LIMIT", 10);
  const queueLimit = readNumberEnv(env, "DB_QUEUE_LIMIT", 0);
  const waitForConnections = readBooleanEnv(env, "DB_WAIT_FOR_CONNECTIONS", true);
  const multipleStatements = readBooleanEnv(env, "DB_MULTIPLE_STATEMENTS", false);
  const debug = readBooleanEnv(env, "DB_DEBUG", false);
  const dbType = readStringEnv(env, "DB_TYPE", "mysql").toLowerCase();

  // 결과 타입 변환: DB/컬럼 성격에 따라 갈리므로 설정으로 남긴다. MYSQL2_WIZARD_* 우선, 예전 이름 fallback
  const castedBoolean = readWizardBoolean(env, "CASTED_BOOLEAN", false);
  const enableMariaDbJson = readWizardBoolean(env, "ENABLE_MARIADB_JSON", false);
  const castedDecimalAsNumber = readWizardBoolean(env, "CASTED_DECIMAL_AS_NUMBER", true);

  const mysql2Options: PoolOptions = {
    host,
    user,
    password,
    ...(database ? { database } : {}),
    port,
    ...(parsedUrl?.ssl ? { ssl: parsedUrl.ssl } : {}),
    ...(parsedUrl?.connectTimeoutMs !== undefined ? { connectTimeout: parsedUrl.connectTimeoutMs } : {}),
    connectionLimit,
    queueLimit,
    waitForConnections,
    multipleStatements,
    debug,
    enableKeepAlive: true,
    dateStrings: true,
    typeCast: createTypeCast({ castedBoolean, enableMariaDbJson, castedDecimalAsNumber }),
  };

  return { mysql2Options, dbType };
};
