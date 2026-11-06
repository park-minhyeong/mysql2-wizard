import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, configureLogging, getLogLevel, isLogEnabled, levelFromEnv, type Logger } from '../../log';

const makeSink = () => {
	const sink: Logger = { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
	return sink;
};

describe('levelFromEnv()', () => {
	it('기본 info, MYSQL2_WIZARD_LOG_LEVEL 우선, 잘못된 값은 무시', () => {
		expect(levelFromEnv({})).toBe('info');
		expect(levelFromEnv({ MYSQL2_WIZARD_LOG_LEVEL: 'WARN ' })).toBe('warn');
		expect(levelFromEnv({ MYSQL2_WIZARD_LOG_LEVEL: 'silent' })).toBe('silent');
		expect(levelFromEnv({ MYSQL2_WIZARD_LOG_LEVEL: 'verbose' })).toBe('info');
	});

	it('하위 호환: DEBUG=true 는 레벨 미설정일 때만 debug', () => {
		expect(levelFromEnv({ DEBUG: 'true' })).toBe('debug');
		expect(levelFromEnv({ DEBUG: 'app:*' })).toBe('info');
		// 다른 패키지용 DEBUG 가 켜져 있어도 명시 레벨이 이긴다
		expect(levelFromEnv({ DEBUG: 'true', MYSQL2_WIZARD_LOG_LEVEL: 'error' })).toBe('error');
	});
});

describe('logger / configureLogging()', () => {
	const originalLevel = getLogLevel();
	let sink: Logger;

	beforeEach(() => {
		sink = makeSink();
		configureLogging({ level: 'info', logger: sink, prefix: '[T] ' });
	});

	afterEach(() => {
		configureLogging({ level: originalLevel, logger: {}, prefix: '[MySQL2 Wizard] ' });
	});

	it('레벨 이하만 출력하고 접두사를 붙인다', () => {
		logger.error('e');
		logger.warn('w');
		logger.log('i');
		logger.debug('d');
		expect(sink.error).toHaveBeenCalledWith('[T] e');
		expect(sink.warn).toHaveBeenCalledWith('[T] w');
		expect(sink.log).toHaveBeenCalledWith('[T] i');
		expect(sink.debug).not.toHaveBeenCalled();
	});

	it('silent 면 error 도 출력하지 않는다', () => {
		configureLogging({ level: 'silent' });
		logger.error('e');
		expect(sink.error).not.toHaveBeenCalled();
		expect(isLogEnabled('error')).toBe(false);
	});

	it('error 레벨이면 warn/info 는 막히고 error 만 통과', () => {
		configureLogging({ level: 'error' });
		logger.warn('w');
		logger.log('i');
		logger.error('e');
		expect(sink.warn).not.toHaveBeenCalled();
		expect(sink.log).not.toHaveBeenCalled();
		expect(sink.error).toHaveBeenCalledTimes(1);
	});

	it('debug 면 전부 출력', () => {
		configureLogging({ level: 'debug' });
		logger.debug('d');
		expect(sink.debug).toHaveBeenCalledWith('[T] d');
		expect(isLogEnabled('debug')).toBe(true);
	});

	it('일부 메서드만 넘기면 나머지는 console 로 간다', () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const error = vi.fn();
		configureLogging({ logger: { error } });
		logger.error('e');
		logger.warn('w');
		expect(error).toHaveBeenCalledWith('[T] e');
		expect(consoleWarn).toHaveBeenCalledWith('[T] w');
		consoleWarn.mockRestore();
	});
});
