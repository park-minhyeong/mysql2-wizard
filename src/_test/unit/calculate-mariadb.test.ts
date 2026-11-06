import { describe, it, expect, vi } from 'vitest';
import type { QueryOption } from '../../interface/Query';
import type { User } from './helpers';
import { buildCalculateQuery } from '../../repository/query/calculate';

vi.mock('../../core/pool', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../core/pool')>();
	return { ...actual, dbType: 'mariadb' };
});

const option = { table: 'users', keys: [] } as unknown as QueryOption<User>;

describe('calculate on MariaDB', () => {
	it('SUM/AVG는 COALESCE로 감싸고 MIN/MAX/COUNT는 그대로', () => {
		const { sql } = buildCalculateQuery<User>(undefined, option, [
			{ fn: 'SUM', alias: 's', column: 'score' },
			{ fn: 'AVG', alias: 'a', column: 'score' },
			{ fn: 'MIN', alias: 'mi', column: 'score' },
			{ fn: 'MAX', alias: 'ma', column: 'score' },
			{ fn: 'COUNT', alias: 'c' },
		]);
		expect(sql).toBe(
			'SELECT SUM(COALESCE(`score`, 0)) AS `s`, AVG(COALESCE(`score`, 0)) AS `a`, MIN(`score`) AS `mi`, MAX(`score`) AS `ma`, COUNT(*) AS `c` FROM `users`'
		);
	});
});
