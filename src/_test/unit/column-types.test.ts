import { describe, it, expect } from 'vitest';
import { repository } from '../../repository';
import { toObject, toRow } from '../../utils';
import { createMockConnection, resultSetHeader } from './helpers';

interface Doc {
	id: number;
	isPublished: string;        // DB는 'Y'/'N' 같은 문자열인데 is_ 접두사 → 휴리스틱이면 boolean으로 깨짐
	format: string;             // 'at'으로 끝나지만 날짜가 아님
	payload: Record<string, unknown> | null;
	expiresOn: Date;            // 날짜지만 이름 휴리스틱(At/Date/Time)에 걸리지 않음
	flag: boolean;              // is_ 접두사 없는 boolean
}
const docKeys = ['id', 'isPublished', 'format', 'payload', 'expiresOn', 'flag'] as const;

const docRepo = repository<Doc, 'id'>({
	table: 'docs',
	keys: docKeys,
	autoSetColumns: ['id'],
	columnTypes: {
		isPublished: 'raw',
		format: 'raw',
		payload: 'json',
		expiresOn: 'date',
		flag: 'boolean',
	},
});

describe('columnTypes — 명시적 변환', () => {
	it('toRow: raw는 그대로, json은 stringify, date는 UTC 문자열, boolean은 1/0', async () => {
		const mock = createMockConnection([resultSetHeader(1, 1)]);
		await docRepo.insert([{
			isPublished: 'Y',
			format: '2025-01-01 00:00:00', // raw → 날짜 문자열이어도 변환하지 않음
			payload: { a: [1, 2] },
			expiresOn: new Date('2025-03-04T05:06:07.000Z'),
			flag: true,
		}], mock.connection);
		expect(mock.calls[0].values).toEqual(['Y', '2025-01-01 00:00:00', '{"a":[1,2]}', '2025-03-04 05:06:07', 1]);
	});

	it('toObject: raw는 그대로, json은 parse, date는 UTC Date, boolean은 boolean', async () => {
		const mock = createMockConnection([[{
			id: 1, is_published: 'Y', format: '2025-01-01 00:00:00', payload: '{"a":[1,2]}', expires_on: '2025-03-04 05:06:07', flag: 1,
		}]]);
		const [doc] = await docRepo.select(undefined, mock.connection);
		expect(doc).toEqual({
			id: 1,
			isPublished: 'Y',
			format: '2025-01-01 00:00:00',
			payload: { a: [1, 2] },
			expiresOn: new Date('2025-03-04T05:06:07.000Z'),
			flag: true,
		});
	});

	it('휴리스틱과 비교: columnTypes 없으면 is_ → boolean, *at → Date 로 해석된다', () => {
		const heuristic = toObject<Doc>([...docKeys], { is_published: 'Y', format: '2025-01-01 00:00:00', flag: 1 });
		expect(heuristic.isPublished).toBe(true);          // 'Y' → Boolean('Y')
		expect(heuristic.format).toBeInstanceOf(Date);     // 'format'은 'at'으로 끝남
		expect(heuristic.flag).toBe(1);                    // is_ 접두사 없음 → 변환 없음
	});

	it('update: boolean 컬럼이 undefined면 SET에서 제외, 지정된 컬럼만 갱신', async () => {
		const mock = createMockConnection([resultSetHeader(1)]);
		await docRepo.update([[{ id: 1 }, { flag: false, payload: null }]], mock.connection);
		expect(mock.calls[0]).toEqual({ sql: 'UPDATE `docs` SET `payload` = ?, `flag` = ? WHERE `id` = ?', values: [null, 0, 1] });
	});

	it('toRow 직접 호출: 명시 타입이 있는 is_ 컬럼은 is_ 휴리스틱을 건너뛴다', () => {
		const row = toRow<Partial<Doc>>([...docKeys], { isPublished: 'N' }, [], undefined, { isPublished: 'raw' });
		expect(row.is_published).toBe('N');
		const heuristicRow = toRow<Partial<Doc>>([...docKeys], { isPublished: 'N' }, []);
		expect(heuristicRow.is_published).toBe(1); // Boolean('N') → 1
	});

	it('date 타입: 문자열 입력(ISO)도 UTC DATETIME으로, 날짜만은 그대로', () => {
		const row = toRow<Record<string, unknown>>(['expiresOn', 'startDay'], {
			expiresOn: '2025-03-04T05:06:07+09:00',
			startDay: '2025-03-04',
		}, [], undefined, { expiresOn: 'date', startDay: 'date' });
		expect(row.expires_on).toBe('2025-03-03 20:06:07');
		expect(row.start_day).toBe('2025-03-04');
	});

	it('relation.columnTypes가 조인 테이블 매핑에도 적용된다', async () => {
		interface Author { id: number; name: string; meta: { role: string } }
		const postRepo = repository<{ id: number; title: string }, 'id'>({
			table: 'posts',
			keys: ['id', 'title'],
			relations: {
				author: {
					table: 'authors', localKey: 'authorId', foreignKey: 'id', type: 'belongsTo',
					keys: ['id', 'name', 'meta'] satisfies (keyof Author)[],
					columnTypes: { meta: 'json', name: 'raw' },
				},
			},
		});
		const mock = createMockConnection([[{ id: 1, title: 't', authors__id: 7, authors__name: '{"x":1}', authors__meta: '{"role":"admin"}' }]]);
		const [post] = await postRepo.select(undefined, mock.connection).with('author');
		expect(post).toEqual({ id: 1, title: 't', author: { id: 7, name: '{"x":1}', meta: { role: 'admin' } } });
	});
});
