import { describe, it, expect } from 'vitest';
import orderBy from '../../repository/query/option/orderBy';
import limit from '../../repository/query/option/limit';
import buildSelectClause from '../../repository/query/select.support';
import buildJoinClause, { buildRelationJoins } from '../../repository/query/relation/join';
import type { User } from './helpers';

describe('orderBy()', () => {
	it('빈 입력은 빈 문자열', () => {
		expect(orderBy<User>(undefined)).toBe('');
		expect(orderBy<User>([])).toBe('');
	});
	it('snake_case 변환 + 방향', () => {
		expect(orderBy<User>([{ column: 'createdAt', direction: 'DESC' }, { column: 'userName', direction: 'ASC' }]))
			.toBe(' ORDER BY `created_at` DESC, `user_name` ASC');
	});
});

describe('limit()', () => {
	it('limit/offset 조합 (0은 생략)', () => {
		expect(limit<User>(undefined)).toBe('');
		expect(limit<User>({})).toBe('');
		expect(limit<User>({ limit: 10 })).toBe(' LIMIT 10');
		expect(limit<User>({ limit: 10, offset: 20 })).toBe(' LIMIT 10 OFFSET 20');
		expect(limit<User>({ limit: 0, offset: 0 })).toBe('');
		expect(limit<User>({ offset: 5 })).toBe(' OFFSET 5');
	});
});

describe('buildSelectClause()', () => {
	it('컬럼 미지정 시 table.* 또는 *', () => {
		expect(buildSelectClause(undefined, 'users')).toBe('`users`.*');
		expect(buildSelectClause([], undefined)).toBe('*');
	});
	it('컬럼 snake_case, table.col, *·함수·AS 표현식은 passthrough', () => {
		expect(buildSelectClause(['userName', 'profiles.bioText', 'profiles.*', 'COUNT(*)', 'a AS b'], 'users'))
			.toBe('`user_name`, `profiles`.`bio_text`, profiles.*, COUNT(*), a AS b');
	});
});

describe('buildJoinClause() / buildRelationJoins()', () => {
	it('JOIN 절 생성 (table.col은 분리 escape)', () => {
		expect(buildJoinClause([{ table: 'profiles', leftColumn: 'users.id', rightColumn: 'profiles.userId', type: 'LEFT' }]))
			.toBe(' LEFT JOIN `profiles` ON `users`.`id` = `profiles`.`user_id`');
		expect(buildJoinClause([{ table: 'p', leftColumn: 'id', rightColumn: 'userId', type: 'INNER' }]))
			.toBe(' INNER JOIN `p` ON `id` = `user_id`');
		expect(buildJoinClause([])).toBe('');
	});

	it('relation → JoinClause (hasMany는 LEFT, 그 외 INNER 기본)', () => {
		const joins = buildRelationJoins(['profile', 'posts'], {
			profile: { table: 'profiles', localKey: 'id', foreignKey: 'userId', type: 'hasOne' },
			posts: { table: 'posts', localKey: 'id', foreignKey: 'authorId', type: 'hasMany' },
		}, 'users');
		expect(joins).toEqual([
			{ table: 'profiles', leftColumn: 'users.id', rightColumn: 'profiles.user_id', type: 'INNER' },
			{ table: 'posts', leftColumn: 'users.id', rightColumn: 'posts.author_id', type: 'LEFT' },
		]);
	});

	it('정의되지 않은 relation은 에러', () => {
		expect(() => buildRelationJoins(['nope'], {}, 'users')).toThrow("Relation 'nope' not found");
	});
});
