import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockConnection } from './helpers';
import { handler as internalHandler } from '../../repository/handler';
import { handler as publicHandler } from '../../config';
import { repository } from '../../repository';
import { PoolError, DbError } from '../../interface';

// getConnection만 가짜로 바꾸고 runInTransaction/releaseConnection은 실제 구현을 사용한다 (vi.mock은 import보다 먼저 호이스팅)
const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }));
vi.mock('../../core/connection', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../core/connection')>();
	return { ...actual, getConnection: () => getConnection() };
});

const sqlError = () => Object.assign(new Error('Duplicate entry'), {
	code: 'ER_DUP_ENTRY', errno: 1062, sqlMessage: 'Duplicate entry', sqlState: '23000', index: 0, sql: 'INSERT ...', sqlParameters: [],
});

beforeEach(() => {
	getConnection.mockReset();
	vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('internal handler (repository/handler)', () => {
	it('기본은 트랜잭션 없이 실행하고 connection을 반환한다', async () => {
		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		const result = await internalHandler(async () => 'ok');
		expect(result).toBe('ok');
		expect(mock.beginTransaction).not.toHaveBeenCalled();
		expect(mock.commit).not.toHaveBeenCalled();
		expect(mock.release).toHaveBeenCalledTimes(1);
	});

	it('useTransaction: begin → commit, 실패 시 rollback 후 원본 에러 rethrow', async () => {
		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		await internalHandler(async () => 1, { useTransaction: true });
		expect(mock.beginTransaction).toHaveBeenCalledTimes(1);
		expect(mock.commit).toHaveBeenCalledTimes(1);

		const error = sqlError();
		await expect(internalHandler(async () => { throw error; }, { useTransaction: true })).rejects.toBe(error);
		expect(mock.rollback).toHaveBeenCalledTimes(1);
		expect(mock.release).toHaveBeenCalledTimes(2);
	});

	it('SQL 에러는 PoolError로 감싸지 않고 그대로 전달된다 (회귀 방지)', async () => {
		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		const error = sqlError();
		await expect(internalHandler(async () => { throw error; })).rejects.toBe(error);
		await expect(internalHandler(async () => { throw error; })).rejects.not.toBeInstanceOf(PoolError);
	});

	it('connection을 얻지 못하면 PoolError, throwError=false면 null', async () => {
		getConnection.mockResolvedValue(null);
		await expect(internalHandler(async () => 1)).rejects.toBeInstanceOf(PoolError);
		await expect(internalHandler(async () => 1, { throwError: false })).resolves.toBeNull();
	});

	it('throwError=false면 에러 대신 null, connection은 반환된다', async () => {
		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		await expect(internalHandler(async () => { throw new Error('x'); }, { throwError: false })).resolves.toBeNull();
		expect(mock.release).toHaveBeenCalledTimes(1);
	});
});

describe('public handler (config)', () => {
	it('기본은 트랜잭션을 열고 commit', async () => {
		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		const result = await publicHandler(async () => 'ok');
		expect(result).toBe('ok');
		expect(mock.beginTransaction).toHaveBeenCalledTimes(1);
		expect(mock.commit).toHaveBeenCalledTimes(1);
		expect(mock.release).toHaveBeenCalledTimes(1);
	});

	it('mysql2 에러는 DbError로 변환, rollback 후 release', async () => {
		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		const promise = publicHandler(async () => { throw sqlError(); });
		await expect(promise).rejects.toBeInstanceOf(DbError);
		await expect(promise).rejects.toMatchObject({ code: 'ER_DUP_ENTRY', sql: 'INSERT ...' });
		expect(mock.rollback).toHaveBeenCalledTimes(1);
		expect(mock.release).toHaveBeenCalledTimes(1);
	});

	it('rollbackIfError=false면 rollback하지 않음, useTransaction=false면 begin/commit 없음', async () => {
		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		await expect(publicHandler(async () => { throw new Error('plain'); }, { rollbackIfError: false })).rejects.toThrow('plain');
		expect(mock.rollback).not.toHaveBeenCalled();

		await publicHandler(async () => 1, { useTransaction: false });
		expect(mock.beginTransaction).toHaveBeenCalledTimes(1); // 첫 호출분만
		expect(mock.commit).not.toHaveBeenCalled();
	});

	it('connection을 얻지 못하면 null, throwError=false면 에러 대신 null', async () => {
		getConnection.mockResolvedValue(null);
		await expect(publicHandler(async () => 1)).resolves.toBeNull();

		const mock = createMockConnection();
		getConnection.mockResolvedValue(mock.connection);
		await expect(publicHandler(async () => { throw sqlError(); }, { throwError: false })).resolves.toBeNull();
	});

	it('beginTransaction 실패 시에도 connection을 반환한다 (누수 방지)', async () => {
		const mock = createMockConnection();
		mock.beginTransaction.mockRejectedValueOnce(new Error('begin failed'));
		getConnection.mockResolvedValue(mock.connection);
		await expect(publicHandler(async () => 1)).rejects.toThrow('begin failed');
		expect(mock.release).toHaveBeenCalledTimes(1);
	});
});

describe('repository → internal handler 연동', () => {
	it('connection 없이 호출하면 handler가 pool connection을 얻어 실행·반환한다', async () => {
		const mock = createMockConnection([[{ id: 1, name: 'a' }]]);
		getConnection.mockResolvedValue(mock.connection);
		const repo = repository<{ id: number; name: string }, 'id'>({ table: 't', keys: ['id', 'name'] });
		const rows = await repo.select({ id: 1 });
		expect(rows).toEqual([{ id: 1, name: 'a' }]);
		expect(mock.calls[0].sql).toBe('SELECT `t`.`id`, `t`.`name` FROM `t` WHERE `id` = ?');
		expect(mock.beginTransaction).not.toHaveBeenCalled();
		expect(mock.release).toHaveBeenCalledTimes(1);
	});
});
