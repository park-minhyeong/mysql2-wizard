import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { QueryOption } from '../../interface';
import { Connection } from '../../interface/Repository';

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

const insert = async <T>(
	objs: T[],
	option: QueryOption<T>,
	connection?: Connection
): Promise<ExtendedResultSetHeader> => {
	// 빈 배열 처리
	if (objs.length === 0) {
		const emptyResult = {
			affectedRows: 0,
			insertId: 0,
			insertIds: [] as number[],
			fieldCount: 0,
			info: '',
			serverStatus: 0,
			warningStatus: 0,
			changedRows: 0,
		} as unknown as ExtendedResultSetHeader;
		if (connection) {
			return emptyResult;
		} else {
			return handler(async () => {
				return emptyResult;
			});
		}
	}

	// SQL 빌드 로직 (connection과 무관)
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
	const params = values.map(value => value.filter((v): v is unknown => v !== undefined)).flat();

	// connection이 제공되면 직접 사용, 없으면 handler 사용
	if (connection) {
		// 트랜잭션 내에서 실행 (handler 없이 직접 connection 사용)
		const [result] = await connection.query<ResultSetHeader>(query, params);

		// insertIds 배열 생성
		const insertIds: number[] = [];
		if (result.insertId && result.affectedRows > 0) {
			if (result.affectedRows === 1) {
				insertIds.push(result.insertId);
			} else {
				for (let i = 0; i < result.affectedRows; i++) {
					insertIds.push(result.insertId + i);
				}
			}
		}

		return {
			...result,
			insertIds
		} as ExtendedResultSetHeader;
	} else {
		// 기존 동작: handler 사용 (하위 호환성)
		return handler(async connection => {
			const [result] = await connection.query<ResultSetHeader>(query, params);

			// insertIds 배열 생성
			const insertIds: number[] = [];
			if (result.insertId && result.affectedRows > 0) {
				if (result.affectedRows === 1) {
					insertIds.push(result.insertId);
				} else {
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
	}
};

export default insert;
