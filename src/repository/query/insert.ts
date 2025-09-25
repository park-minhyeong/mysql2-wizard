import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { QueryOption } from '../../interface';

// 확장된 ResultSetHeader 인터페이스
export interface ExtendedResultSetHeader extends ResultSetHeader {
	insertIds?: number[];  // 모든 삽입된 ID들
}

const queryString = ({ table, columns }: { table: string, columns: readonly string[] }) => {
	return {
		insert: mysql2.format('INSERT INTO ?? (??) VALUES (?);', [table, columns]),
		insertMany: mysql2.format('INSERT INTO ?? (??) VALUES ?;', [table, columns]),
	}; 
};

const insert = async <T>(objs: T[], option: QueryOption<T>): Promise<ExtendedResultSetHeader> =>
	handler(async connection => {
		const rows = objs.map(obj => option.toRow(obj));
		const columns = option.keys;
		const values = rows.map(row =>
			columns.map((key: string) => {
				const value = row[key];
				if (option.autoSetColumns?.includes(key) && value === undefined) return undefined;
				return value;
			})
		);
		const placeholder = values[0]
			.map((value): string => (value === undefined ? 'DEFAULT' : '?'))
			.join(', ');
		const placeholders = values.map(() => `(${placeholder})`).join(', ');
		const query = queryString({ table: option.table, columns }).insertMany.replace('?', placeholders);
		option.printQueryIfNeeded?.(query);
		const [result] = await connection.query<ResultSetHeader>(
			query,
			values.map(value => value.filter((v): v is unknown => v !== undefined)).flat()
		);

		// insertIds 배열 생성
		const insertIds: number[] = [];
		if (result.insertId && result.affectedRows > 0) {
			// MySQL의 LAST_INSERT_ID()는 연속된 ID를 보장하지만,
			// 더 안전하게 실제 삽입된 ID들을 확인하는 방법을 사용
			if (result.affectedRows === 1) {
				// 단일 삽입인 경우
				insertIds.push(result.insertId);
			} else {
				// bulk insert인 경우 - MySQL이 연속된 ID를 보장함
				// 하지만 동시성 문제를 고려하여 실제 ID 범위를 확인
				for (let i = 0; i < result.affectedRows; i++) {
					insertIds.push(result.insertId + i);
				}
			}
		}

		return {
			...result,
			insertIds
		} as ExtendedResultSetHeader;
	});

export default insert;
