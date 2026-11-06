import { describe, it, expect } from 'vitest';
import { repository } from '../../repository';
import { createMockConnection, resultSetHeader, userKeys, type User, type UserAutoSet } from './helpers';

const userRepo = repository<User, UserAutoSet>({
	table: 'users',
	keys: userKeys,
	autoSetColumns: ['id', 'createdAt'],
});

const allColumns = '`users`.`id`, `users`.`user_name`, `users`.`is_active`, `users`.`metadata`, `users`.`created_at`, `users`.`score`';

describe('repository.select() SQL', () => {
	it('조건 없음 → keys 기반 컬럼 목록', async () => {
		const mock = createMockConnection([[]]);
		await userRepo.select(undefined, mock.connection);
		expect(mock.calls[0]).toEqual({ sql: `SELECT ${allColumns} FROM \`users\``, values: [] });
	});

	it('WHERE + ORDER BY + LIMIT/OFFSET 체이닝', async () => {
		const mock = createMockConnection([[]]);
		await userRepo
			.select({ isActive: true, id: [1, 2] }, mock.connection)
			.orderBy([{ column: 'createdAt', direction: 'DESC' }])
			.limit(10)
			.offset(20);
		expect(mock.calls[0]).toEqual({
			sql: `SELECT ${allColumns} FROM \`users\` WHERE \`is_active\` = ? AND \`id\` IN (?, ?) ORDER BY \`created_at\` DESC LIMIT 10 OFFSET 20`,
			values: [true, 1, 2],
		});
	});

	it('execute(connection)이 생성자 connection보다 우선', async () => {
		const a = createMockConnection([[]]);
		const b = createMockConnection([[]]);
		await userRepo.select({ id: 1 }, a.connection).execute(b.connection);
		expect(a.calls).toHaveLength(0);
		expect(b.calls).toHaveLength(1);
	});

	it('or()만 있는 경우와 메인 조건 + or() 결합', async () => {
		const mock = createMockConnection([[], []]);
		await userRepo.select({}, mock.connection).or({ score: 1 }).or([{ score: 2 }, { userName: undefined }]);
		expect(mock.calls[0].sql).toBe(`SELECT ${allColumns} FROM \`users\` WHERE (\`score\` = ?) OR (\`score\` = ?)`);
		expect(mock.calls[0].values).toEqual([1, 2]);

		await userRepo.select({ isActive: false }, mock.connection).or({ score: 9 });
		expect(mock.calls[1].sql).toBe(`SELECT ${allColumns} FROM \`users\` WHERE (\`is_active\` = ?) AND ((\`score\` = ?))`);
		expect(mock.calls[1].values).toEqual([false, 9]);
	});

	it('모든 조건이 undefined이면 WHERE 생략', async () => {
		const mock = createMockConnection([[]]);
		await userRepo.select({ userName: undefined }, mock.connection).or({ userName: { operator: 'LIKE', value: undefined } });
		expect(mock.calls[0].sql).toBe(`SELECT ${allColumns} FROM \`users\``);
	});

	it('select([...]) 컬럼 지정 + join()', async () => {
		const mock = createMockConnection([[]]);
		await userRepo
			.select({ isActive: true }, mock.connection)
			.join('profiles', 'users.id', 'profiles.userId', 'LEFT')
			.select(['users.id', 'profiles.bio']);
		expect(mock.calls[0].sql).toBe(
			'SELECT `users`.`id`, `profiles`.`bio` FROM `users` LEFT JOIN `profiles` ON `users`.`id` = `profiles`.`user_id` WHERE `is_active` = ?'
		);
	});

	it('rows → toObject 변환 (boolean/JSON/Date)', async () => {
		const mock = createMockConnection([[
			{ id: 1, user_name: 'kim', is_active: 1, metadata: '{"a":1}', created_at: '2025-01-02 03:04:05', score: 5 },
		]]);
		const [user] = await userRepo.select(undefined, mock.connection);
		expect(user).toEqual({
			id: 1,
			userName: 'kim',
			isActive: true,
			metadata: { a: 1 },
			createdAt: new Date('2025-01-02T03:04:05.000Z'),
			score: 5,
		});
	});
});

describe('repository.selectOne() SQL', () => {
	it('LIMIT 1 자동, 없으면 undefined', async () => {
		const mock = createMockConnection([[]]);
		const result = await userRepo.selectOne({ id: 3 }, mock.connection).orderBy([{ column: 'id', direction: 'ASC' }]);
		expect(mock.calls[0]).toEqual({
			sql: `SELECT ${allColumns} FROM \`users\` WHERE \`id\` = ? ORDER BY \`id\` ASC LIMIT 1`,
			values: [3],
		});
		expect(result).toBeUndefined();
	});

	it('첫 행을 객체로 반환', async () => {
		const mock = createMockConnection([[{ id: 3, user_name: 'lee', is_active: 0, metadata: null, created_at: null, score: 0 }]]);
		const result = await userRepo.selectOne({ id: 3 }, mock.connection);
		expect(result?.userName).toBe('lee');
		expect(result?.isActive).toBe(false);
		expect(result?.metadata).toBeNull();
	});

	it('or()와 빈 쿼리', async () => {
		const mock = createMockConnection([[]]);
		await userRepo.selectOne({}, mock.connection).or({ score: 1 });
		expect(mock.calls[0].sql).toBe(`SELECT ${allColumns} FROM \`users\` WHERE (\`score\` = ?) LIMIT 1`);
	});
});

interface Post { id: number; title: string; authorId: number }
interface Profile { id: number; userId: number; bio: string }
const relRepo = repository<User, UserAutoSet>({
	table: 'users',
	keys: ['id', 'userName'],
	relations: {
		profile: { table: 'profiles', localKey: 'id', foreignKey: 'userId', type: 'hasOne', keys: ['id', 'bio'] satisfies (keyof Profile)[] },
		posts: { table: 'posts', localKey: 'id', foreignKey: 'authorId', type: 'hasMany', keys: ['id', 'title'] satisfies (keyof Post)[] },
	},
});

describe('repository relations (with)', () => {
	it('hasOne: 별칭 컬럼 + INNER JOIN, 중첩 객체 / null 매핑', async () => {
		const mock = createMockConnection([[
			{ id: 1, user_name: 'a', profiles__id: 10, profiles__bio: 'hi' },
			{ id: 2, user_name: 'b', profiles__id: null, profiles__bio: null },
		]]);
		const rows = await relRepo.select(undefined, mock.connection).with('profile');
		expect(mock.calls[0].sql).toBe(
			'SELECT `users`.`id`, `users`.`user_name`, `profiles`.`id` AS `profiles__id`, `profiles`.`bio` AS `profiles__bio` FROM `users` INNER JOIN `profiles` ON `users`.`id` = `profiles`.`user_id`'
		);
		expect(rows).toEqual([
			{ id: 1, userName: 'a', profile: { id: 10, bio: 'hi' } },
			{ id: 2, userName: 'b', profile: null },
		]);
	});

	it('hasMany: LEFT JOIN + 메인 레코드 기준 그룹화, 중복 제거', async () => {
		const mock = createMockConnection([[
			{ id: 1, user_name: 'a', posts__id: 100, posts__title: 'p1' },
			{ id: 1, user_name: 'a', posts__id: 101, posts__title: 'p2' },
			{ id: 1, user_name: 'a', posts__id: 101, posts__title: 'p2' },
			{ id: 2, user_name: 'b', posts__id: null, posts__title: null },
		]]);
		const rows = await relRepo.select(undefined, mock.connection).with('posts');
		expect(mock.calls[0].sql).toContain(' LEFT JOIN `posts` ON `users`.`id` = `posts`.`author_id`');
		expect(rows).toEqual([
			{ id: 1, userName: 'a', posts: [{ id: 100, title: 'p1' }, { id: 101, title: 'p2' }] },
			{ id: 2, userName: 'b', posts: [] },
		]);
	});

	it('hasOne + hasMany 동시 사용 시 hasOne은 단일 객체, hasMany는 배열', async () => {
		const mock = createMockConnection([[
			{ id: 1, user_name: 'a', profiles__id: 10, profiles__bio: 'hi', posts__id: 100, posts__title: 'p1' },
			{ id: 1, user_name: 'a', profiles__id: 10, profiles__bio: 'hi', posts__id: 101, posts__title: 'p2' },
		]]);
		const rows = await relRepo.select(undefined, mock.connection).with('profile').with('posts');
		expect(rows).toEqual([
			{ id: 1, userName: 'a', profile: { id: 10, bio: 'hi' }, posts: [{ id: 100, title: 'p1' }, { id: 101, title: 'p2' }] },
		]);
	});

	it('selectOne + with', async () => {
		const mock = createMockConnection([[{ id: 1, user_name: 'a', profiles__id: 10, profiles__bio: 'hi' }]]);
		const row = await relRepo.selectOne({ id: 1 }, mock.connection).with('profile');
		expect(mock.calls[0].sql.endsWith(' WHERE `id` = ? LIMIT 1')).toBe(true);
		expect(row).toEqual({ id: 1, userName: 'a', profile: { id: 10, bio: 'hi' } });
	});
});

describe('repository.insert() SQL', () => {
	it('autoSet 컬럼은 DEFAULT, 값 변환(boolean/JSON/Date) 및 insertIds', async () => {
		const mock = createMockConnection([resultSetHeader(2, 50)]);
		const result = await userRepo.insert([
			{ userName: 'a', isActive: true, metadata: { x: 1 }, score: 1 },
			{ userName: 'b', isActive: false, metadata: null, score: 2 },
		], mock.connection);
		expect(mock.calls[0]).toEqual({
			sql: 'INSERT INTO `users` (`id`, `user_name`, `is_active`, `metadata`, `created_at`, `score`) VALUES (DEFAULT, ?, ?, ?, DEFAULT, ?), (DEFAULT, ?, ?, ?, DEFAULT, ?);',
			values: ['a', 1, '{"x":1}', 1, 'b', 0, null, 2],
		});
		expect(result.affectedRows).toBe(2);
		expect(result.insertIds).toEqual([50, 51]);
	});

	it('빈 배열이면 쿼리 없이 affectedRows 0', async () => {
		const mock = createMockConnection();
		const result = await userRepo.insert([], mock.connection);
		expect(mock.calls).toHaveLength(0);
		expect(result.affectedRows).toBe(0);
		expect(result.insertIds).toEqual([]);
	});
});

describe('repository.update() / delete() SQL', () => {
	it('update: 지정한 컬럼만 SET, 조건은 WHERE, affectedRows 합산', async () => {
		const mock = createMockConnection([resultSetHeader(1), resultSetHeader(2)]);
		const result = await userRepo.update([
			[{ id: 1 }, { userName: 'z', isActive: false }],
			[{ score: { operator: '<', value: 0 } }, { score: 0 }],
		], mock.connection);
		expect(mock.calls[0]).toEqual({
			sql: 'UPDATE `users` SET `user_name` = ?, `is_active` = ? WHERE `id` = ?',
			values: ['z', 0, 1],
		});
		expect(mock.calls[1]).toEqual({ sql: 'UPDATE `users` SET `score` = ? WHERE `score` < ?', values: [0, 0] });
		expect(result.affectedRows).toBe(3);
	});

	it('delete: 조건별 DELETE, affectedRows 합산', async () => {
		const mock = createMockConnection([resultSetHeader(1), resultSetHeader(4)]);
		const result = await userRepo.delete([{ id: 1 }, { id: [2, 3, 4, 5] }], mock.connection);
		expect(mock.calls[0]).toEqual({ sql: 'DELETE FROM `users` WHERE `id` = ?', values: [1] });
		expect(mock.calls[1]).toEqual({ sql: 'DELETE FROM `users` WHERE `id` IN (?, ?, ?, ?)', values: [2, 3, 4, 5] });
		expect(result.affectedRows).toBe(5);
	});
});
