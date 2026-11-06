import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryOption } from '../../interface/Query';
import { createMockConnection, type User } from './helpers';
import { buildCalculateQuery } from '../../repository/query/calculate';
import { repository } from '../../repository';
import { buildAggregateQuery } from '../../repository/query/calculate/aggregate';

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }));
vi.mock('../../core/connection', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../core/connection')>();
	return { ...actual, getConnection: () => getConnection() };
});
// dbType을 고정해 환경(.env)과 무관하게 검증
vi.mock('../../core/pool', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../core/pool')>();
	return { ...actual, dbType: 'mysql' };
});

const option = { table: 'users', keys: [] } as unknown as QueryOption<User>;

beforeEach(() => {
	getConnection.mockReset();
});

describe('buildCalculateQuery()', () => {
	it('COUNT(*) / COUNT(col) / SUM / AVG / MIN / MAX 기본형', () => {
		const { sql, values } = buildCalculateQuery<User>(undefined, option, [
			{ fn: 'COUNT', alias: 'total' },
			{ fn: 'COUNT', alias: 'named', column: 'userName' },
			{ fn: 'SUM', alias: 'sum', column: 'score' },
			{ fn: 'AVG', alias: 'avg', column: 'score' },
			{ fn: 'MIN', alias: 'min', column: 'score' },
			{ fn: 'MAX', alias: 'max', column: 'score' },
		]);
		expect(sql).toBe(
			'SELECT COUNT(*) AS `total`, COUNT(`user_name`) AS `named`, SUM(`score`) AS `sum`, AVG(`score`) AS `avg`, MIN(`score`) AS `min`, MAX(`score`) AS `max` FROM `users`'
		);
		expect(values).toEqual([]);
	});

	it('CASE WHEN: when 조건 값만 바인딩하고 then/else는 리터럴, WHERE 값은 뒤에 온다', () => {
		const { sql, values } = buildCalculateQuery<User>({ isActive: true }, option, [
			{ fn: 'COUNT', alias: 'high', case: { when: { score: { operator: '>', value: 90 } } } },
			{ fn: 'SUM', alias: 'bonus', column: 'score', case: { when: { score: { operator: '>=', value: 50 } }, then: 10, else: 0 } },
		]);
		expect(sql).toBe(
			'SELECT COUNT(CASE WHEN `score` > ? THEN 1 END) AS `high`, SUM(CASE WHEN `score` >= ? THEN 10 ELSE 0 END) AS `bonus` FROM `users` WHERE `is_active` = ?'
		);
		// 플레이스홀더 수(3) == 바인딩 수(3)
		expect(values).toEqual([90, 50, true]);
		expect(sql.split('?').length - 1).toBe(values.length);
	});

	it('SUM은 then=0을 그대로 쓰고, AVG/MIN/MAX는 then 미지정 시 1', () => {
		const sum = buildAggregateQuery<User>('SUM', { alias: 's', column: 'score', case: { when: { score: 1 }, then: 0 } }, option, then => (typeof then !== 'undefined' ? then : 1));
		expect(sum.query).toBe('SUM(CASE WHEN `score` = ? THEN 0 ELSE 0 END) AS `s`');
		const max = buildAggregateQuery<User>('MAX', { alias: 'm', column: 'score', case: { when: { score: 1 } } }, option, then => then || 1);
		expect(max.query).toBe('MAX(CASE WHEN `score` = ? THEN 1 ELSE 0 END) AS `m`');
	});

	it('or 조건만 있어도 WHERE를 붙인다', () => {
		const { sql, values } = buildCalculateQuery<User>({}, option, [{ fn: 'COUNT', alias: 'c' }], { orConditions: [{ score: 1 }, { score: 2 }] });
		expect(sql).toBe('SELECT COUNT(*) AS `c` FROM `users` WHERE (`score` = ?) OR (`score` = ?)');
		expect(values).toEqual([1, 2]);
	});
});

describe('select().calculate()', () => {
	it('alias → number 매핑, NULL은 0', async () => {
		const mock = createMockConnection([[{ total: '3', sum: null }]]);
		getConnection.mockResolvedValue(mock.connection);
		const repo = repository<User, 'id'>({ table: 'users', keys: ['id', 'score'] });
		const result = await repo.select({ isActive: true }).calculate<{ total: number; sum: number }>([
			{ fn: 'COUNT', alias: 'total' },
			{ fn: 'SUM', alias: 'sum', column: 'score' },
		]);
		expect(result).toEqual({ total: 3, sum: 0 });
		expect(mock.calls[0].sql).toBe('SELECT COUNT(*) AS `total`, SUM(`score`) AS `sum` FROM `users` WHERE `is_active` = ?');
		expect(mock.release).toHaveBeenCalledTimes(1);
	});
});
