import { describe, it, expect } from 'vitest';
import where from '../../repository/query/condition/where';
import set from '../../repository/query/condition/set';
import type { QueryOption } from '../../interface/Query';
import type { User } from './helpers';

const option = { table: 'users', keys: [] } as unknown as QueryOption<User>; // where/set은 option을 읽지 않는다

describe('where()', () => {
	it('단순 등호 비교는 snake_case 컬럼 + ? 바인딩', () => {
		const { conditions, values } = where<User>({ userName: 'kim', score: 10 }, option);
		expect(conditions).toBe('`user_name` = ? AND `score` = ?');
		expect(values).toEqual(['kim', 10]);
	});

	it('undefined 값은 조건에서 제외, null은 IS NULL', () => {
		const { conditions, values } = where<User>({ userName: undefined, metadata: null }, option);
		expect(conditions).toBe('`metadata` IS NULL');
		expect(values).toEqual([]);
	});

	it('배열은 IN 절', () => {
		const { conditions, values } = where<User>({ id: [1, 2, 3] }, option);
		expect(conditions).toBe('`id` IN (?, ?, ?)');
		expect(values).toEqual([1, 2, 3]);
	});

	it('operator 객체: 비교 연산자 / IN', () => {
		const r1 = where<User>({ score: { operator: '>=', value: 5 } }, option);
		expect(r1.conditions).toBe('`score` >= ?');
		expect(r1.values).toEqual([5]);

		const r2 = where<User>({ id: { operator: 'IN', value: [7, 8] } }, option);
		expect(r2.conditions).toBe('`id` IN (?, ?)');
		expect(r2.values).toEqual([7, 8]);
	});

	it('operator 객체의 null 값: = → IS NULL, != → IS NOT NULL, 그 외 제외', () => {
		expect(where<User>({ metadata: { operator: '=', value: null } }, option).conditions).toBe('`metadata` IS NULL');
		expect(where<User>({ metadata: { operator: '!=', value: null } }, option).conditions).toBe('`metadata` IS NOT NULL');
		expect(where<User>({ metadata: { operator: '>', value: null } }, option).conditions).toBe('');
	});

	it('LIKE: 기본 contains, 패턴별 와일드카드, collation CAST 유지', () => {
		const base = where<User>({ userName: { operator: 'LIKE', value: 'ki' } }, option);
		expect(base.conditions).toBe('`user_name` LIKE CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci');
		expect(base.values).toEqual(['%ki%']);

		expect(where<User>({ userName: { operator: 'LIKE', value: 'ki', pattern: 'starts' } }, option).values).toEqual(['ki%']);
		expect(where<User>({ userName: { operator: 'LIKE', value: 'ki', pattern: 'ends' } }, option).values).toEqual(['%ki']);
		expect(where<User>({ userName: { operator: 'LIKE', value: 'ki', pattern: 'exact' } }, option).values).toEqual(['ki']);
	});

	it('LIKE: undefined / 빈 문자열은 조건 제외', () => {
		expect(where<User>({ userName: { operator: 'LIKE', value: undefined } }, option).conditions).toBe('');
		expect(where<User>({ userName: { operator: 'LIKE', value: '' } }, option).conditions).toBe('');
	});

	it('LIKE: JSON 객체 값은 JSON_EXTRACT 경로별 OR', () => {
		const { conditions, values } = where<User>(
			{ metadata: { operator: 'LIKE', value: { name: 'a', city: 'b' } } },
			option
		);
		expect(conditions).toBe(
			'(CAST(JSON_UNQUOTE(JSON_EXTRACT(`metadata`, ?)) AS CHAR) LIKE ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(`metadata`, ?)) AS CHAR) LIKE ?)'
		);
		expect(values).toEqual(['$.name', '%a%', '$.city', '%b%']);
	});

	it('IN_JSON: 평탄 배열은 JSON_OVERLAPS, 중첩 배열은 JSON_CONTAINS OR', () => {
		type Tagged = { tag: number; tags: number[] };
		const taggedOption = option as unknown as QueryOption<Tagged>;
		const flat = where<Tagged>({ tag: { operator: 'IN_JSON', value: [1, 2] } }, taggedOption);
		expect(flat.conditions).toBe('JSON_OVERLAPS(`tag`, JSON_ARRAY(?, ?))');
		expect(flat.values).toEqual([1, 2]);

		const nested = where<Tagged>({ tags: { operator: 'IN_JSON', value: [[1, 2], [3]] } }, taggedOption);
		expect(nested.conditions).toBe('(JSON_CONTAINS(`tags`, JSON_ARRAY(?, ?)) OR JSON_CONTAINS(`tags`, JSON_ARRAY(?)))');
		expect(nested.values).toEqual([1, 2, 3]);

		expect(where<Tagged>({ tags: { operator: 'IN_JSON', value: [] } }, taggedOption).conditions).toBe('');
	});

	it('OR 조건: 메인 조건과 (A) OR (B) 결합, 값 순서 유지', () => {
		const { conditions, values } = where<User>(
			{ isActive: true },
			option,
			[{ userName: { operator: 'LIKE', value: 'a' } }, { score: 3, userName: undefined }]
		);
		expect(conditions).toBe(
			'(`is_active` = ?) AND ((`user_name` LIKE CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) OR (`score` = ?))'
		);
		expect(values).toEqual([true, '%a%', 3]);
	});

	it('OR 조건만 있는 경우 괄호 없이 OR 결합, 빈 OR 항목은 무시', () => {
		const { conditions, values } = where<User>({}, option, [{ score: 1 }, { userName: undefined }, { score: 2 }]);
		expect(conditions).toBe('(`score` = ?) OR (`score` = ?)');
		expect(values).toEqual([1, 2]);
	});
});

describe('set()', () => {
	it('undefined는 제외하고 컬럼명을 그대로 사용', () => {
		const { setConditions, setValues } = set<User>({ user_name: 'a', score: undefined, is_active: 0 }, option);
		expect(setConditions).toBe('`user_name` = ?, `is_active` = ?');
		expect(setValues).toEqual(['a', 0]);
	});
});
