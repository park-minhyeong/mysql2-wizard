import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConnection } from '../../core/connection';
import { configureLogging, getLogLevel, type Logger } from '../../log';

// pool 모듈을 통째로 가짜로 바꿔 실제 mysql2 pool 없이 재시도/ping 로직만 검증한다
const mocks = vi.hoisted(() => ({
	poolGetConnection: vi.fn(),
	poolConfig: {
		mysql2Options: { host: 'h', port: 3306, user: 'u', database: 'd', connectionLimit: 10, queueLimit: 0 },
		connectionRetryCount: 2,
		connectionRetryDelay: 0,
		pingOnAcquire: true,
	},
}));

vi.mock('../../core/pool', () => ({
	pool: { getConnection: () => mocks.poolGetConnection() },
	poolConfig: mocks.poolConfig,
	getPoolStatus: () => ({ total: 1, free: 0, queue: 0 }),
}));

const makeConnection = (pingError?: Error) => ({
	ping: pingError ? vi.fn().mockRejectedValue(pingError) : vi.fn().mockResolvedValue(undefined),
	destroy: vi.fn(),
	release: vi.fn(),
});

const withCode = (message: string, code: string) => Object.assign(new Error(message), { code });

describe('getConnection()', () => {
	const originalLevel = getLogLevel();
	let sink: Logger;

	beforeEach(() => {
		mocks.poolGetConnection.mockReset();
		mocks.poolConfig.pingOnAcquire = true;
		mocks.poolConfig.connectionRetryCount = 2;
		sink = { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
		configureLogging({ level: 'debug', logger: sink });
	});

	afterEach(() => {
		configureLogging({ level: originalLevel, logger: {} });
	});

	it('정상: ping 후 connection 반환', async () => {
		const conn = makeConnection();
		mocks.poolGetConnection.mockResolvedValue(conn);
		await expect(getConnection()).resolves.toBe(conn);
		expect(conn.ping).toHaveBeenCalledTimes(1);
		expect(sink.error).not.toHaveBeenCalled();
	});

	it('pingOnAcquire=false 면 ping 하지 않는다', async () => {
		mocks.poolConfig.pingOnAcquire = false;
		const conn = makeConnection();
		mocks.poolGetConnection.mockResolvedValue(conn);
		await getConnection();
		expect(conn.ping).not.toHaveBeenCalled();
	});

	it('ping 실패 → destroy 후 재시도 (warn 1회), 두 번째 connection 반환', async () => {
		const dead = makeConnection(new Error('socket closed'));
		const alive = makeConnection();
		mocks.poolGetConnection.mockResolvedValueOnce(dead).mockResolvedValueOnce(alive);
		await expect(getConnection()).resolves.toBe(alive);
		expect(dead.destroy).toHaveBeenCalledTimes(1);
		expect(sink.warn).toHaveBeenCalledTimes(1);
		expect(String(vi.mocked(sink.warn).mock.calls[0][0])).toContain('Connection lost');
		expect(sink.error).not.toHaveBeenCalled();
	});

	it('Too many connections 는 재시도 횟수만큼 반복 후 null, error 요약은 한 줄', async () => {
		mocks.poolGetConnection.mockRejectedValue(withCode('Too many connections', 'ER_CON_COUNT_ERROR'));
		await expect(getConnection()).resolves.toBeNull();
		expect(mocks.poolGetConnection).toHaveBeenCalledTimes(3); // 1 + retry 2
		expect(sink.warn).toHaveBeenCalledTimes(2);
		expect(sink.error).toHaveBeenCalledTimes(1);
		expect(String(vi.mocked(sink.error).mock.calls[0][0])).toContain('attempt 3/3');
		// 상세(설정/pool 상태/stack)는 debug 로만
		expect(vi.mocked(sink.debug).mock.calls.some(([m]) => String(m).includes('Connection configuration'))).toBe(true);
		expect(vi.mocked(sink.debug).mock.calls.some(([m]) => String(m).includes('Pool status'))).toBe(true);
	});

	it('재시도 대상이 아닌 에러(인증 실패 등)는 즉시 null, warn 없음', async () => {
		mocks.poolGetConnection.mockRejectedValue(withCode('Access denied', 'ER_ACCESS_DENIED_ERROR'));
		await expect(getConnection()).resolves.toBeNull();
		expect(mocks.poolGetConnection).toHaveBeenCalledTimes(1);
		expect(sink.warn).not.toHaveBeenCalled();
		expect(sink.error).toHaveBeenCalledTimes(1);
	});

	it('error 레벨이면 상세 debug 로그는 생성하지 않는다', async () => {
		configureLogging({ level: 'error' });
		mocks.poolGetConnection.mockRejectedValue(withCode('Access denied', 'ER_ACCESS_DENIED_ERROR'));
		await getConnection();
		expect(sink.error).toHaveBeenCalledTimes(1);
		expect(sink.debug).not.toHaveBeenCalled();
	});
});
