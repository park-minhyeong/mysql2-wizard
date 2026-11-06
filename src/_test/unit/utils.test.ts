import { describe, it, expect } from 'vitest';
import { toObject, toRow, toBoolean, toDbBoolean, convertToSnakeString, convertToSnakeStrings } from '../../utils';
import { userKeys, type User } from './helpers';

const keys = [...userKeys];
const autoSet = ['id', 'created_at'];

describe('convertToSnakeString()', () => {
	it('camelCase → snake_case', () => {
		expect(convertToSnakeString('userName')).toBe('user_name');
		expect(convertToSnakeString('id')).toBe('id');
		expect(convertToSnakeStrings(['isActive', 'createdAt'])).toEqual(['is_active', 'created_at']);
	});
});

describe('toBoolean() / toDbBoolean()', () => {
	it('1/0, "1"/"0", boolean 처리', () => {
		expect(toBoolean(1)).toBe(true);
		expect(toBoolean('0')).toBe(false);
		expect(toBoolean(true)).toBe(true);
		expect(toDbBoolean(true)).toBe(1);
		expect(toDbBoolean('0')).toBe(0);
		expect(toDbBoolean(undefined)).toBe(0);
		expect(toDbBoolean(null)).toBe(0);
	});
});

describe('toObject() — 휴리스틱(기본) 변환', () => {
	it('is_ 접두사는 boolean, JSON 문자열은 파싱, 날짜 필드는 UTC Date', () => {
		const obj = toObject<User>(keys, {
			id: 1,
			user_name: 'kim',
			is_active: 1,
			metadata: '{"a":1}',
			created_at: '2025-01-02 03:04:05',
			score: 7,
		});
		expect(obj.id).toBe(1);
		expect(obj.userName).toBe('kim');
		expect(obj.isActive).toBe(true);
		expect(obj.metadata).toEqual({ a: 1 });
		expect(obj.createdAt).toBeInstanceOf(Date);
		expect((obj.createdAt as Date).toISOString()).toBe('2025-01-02T03:04:05.000Z');
		expect(obj.score).toBe(7);
	});

	it('이스케이프된 JSON 문자열도 파싱, 일반 문자열은 그대로', () => {
		const obj = toObject<User>(keys, { metadata: '"{\\"b\\":2}"', user_name: 'plain' });
		expect(obj.metadata).toEqual({ b: 2 });
		expect(obj.userName).toBe('plain');
	});

	it('없는 컬럼은 undefined', () => {
		const obj = toObject<User>(keys, {});
		expect(obj.userName).toBeUndefined();
	});
});

describe('toRow() — 휴리스틱(기본) 변환', () => {
	it('autoSet 키는 undefined, 객체는 JSON, is_는 1/0', () => {
		const row = toRow<Partial<User>>(keys, {
			id: 99,
			userName: 'kim',
			isActive: true,
			metadata: { a: 1 },
			score: 3,
		}, autoSet);
		expect(row).toEqual({
			id: undefined,
			user_name: 'kim',
			is_active: 1,
			metadata: '{"a":1}',
			created_at: undefined,
			score: 3,
		});
	});

	it('Date 객체는 UTC DATETIME 문자열로 직렬화', () => {
		const row = toRow<Record<string, unknown>>(['startedAt'], { startedAt: new Date('2025-01-02T03:04:05.000Z') }, []);
		expect(row.started_at).toBe('2025-01-02 03:04:05');
	});

	it('isAutoSet=false면 autoSet 키도 그대로 기록', () => {
		const row = toRow<Partial<User>>(keys, { id: 5, createdAt: new Date('2025-01-02T03:04:05.000Z') }, autoSet, { isAutoSet: false });
		expect(row.id).toBe(5);
		expect(row.created_at).toBe('2025-01-02 03:04:05');
	});

	it('undefined인 is_ 필드는 결과에서 제외 (UPDATE 부분 갱신용)', () => {
		const row = toRow<Partial<User>>(keys, { userName: 'x' }, autoSet);
		expect('is_active' in row).toBe(false);
		expect(row.user_name).toBe('x');
	});

	it('ISO 8601 문자열은 UTC DATETIME으로, 날짜만(YYYY-MM-DD)은 그대로', () => {
		const row = toRow<Record<string, unknown>>(['startedAt', 'birthDate'], {
			startedAt: '2025-06-01T00:00:00+09:00',
			birthDate: '2025-06-01',
		}, []);
		expect(row.started_at).toBe('2025-05-31 15:00:00');
		expect(row.birth_date).toBe('2025-06-01');
	});
});
