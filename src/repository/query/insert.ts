import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { QueryOption } from '../../interface';
import { Connection } from '../../interface/Repository';

// 확장된 ResultSetHeader 인터페이스
export interface ExtendedResultSetHeader extends ResultSetHeader {
	insertIds?: number[];  // 모든 삽입된 ID들
}

const emptyResultSetHeader = (): ExtendedResultSetHeader => ({
	affectedRows: 0,
	insertId: 0,
	insertIds: [],
	fieldCount: 0,
	info: '',
	serverStatus: 0,
	warningStatus: 0,
	changedRows: 0,
} as ExtendedResultSetHeader); // ResultSetHeader의 `constructor` 선언 때문에 리터럴로는 채울 수 없다

/** AUTO_INCREMENT는 연속 할당이므로 insertId부터 affectedRows개를 insertIds로 복원한다. */
const withInsertIds = (result: ResultSetHeader): ExtendedResultSetHeader => {
	const insertIds: number[] = [];
	if (result.insertId && result.affectedRows > 0) {
		for (let i = 0; i < result.affectedRows; i++) {
			insertIds.push(result.insertId + i);
		}
	}
	return { ...result, insertIds };
};

/** INSERT 문과 바인딩 값을 만든다. autoSet 컬럼이 비어 있으면 DEFAULT. */
export const buildInsertQuery = <T>(objs: Partial<T>[], option: QueryOption<T>): { sql: string; params: unknown[] } => {
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
	const sql = mysql2.format('INSERT INTO ?? (??) VALUES ?;', [option.table, columns]).replace('?', placeholders);
	const params = values.flatMap(value => value.filter((v): v is unknown => v !== undefined));
	return { sql, params };
};

const insert = async <T>(
	objs: Partial<T>[],
	option: QueryOption<T>,
	connection?: Connection
): Promise<ExtendedResultSetHeader> => {
	// 빈 배열 처리
	if (objs.length === 0) {
		const emptyResult = emptyResultSetHeader();
		return connection ? emptyResult : handler(async () => emptyResult);
	}

	const { sql, params } = buildInsertQuery(objs, option);
	option.printQueryIfNeeded?.(sql);

	const executeInsert = async (conn: Connection): Promise<ExtendedResultSetHeader> => {
		const [result] = await conn.query<ResultSetHeader>(sql, params);
		return withInsertIds(result);
	};

	// connection이 제공되면 트랜잭션 내에서 직접 실행, 없으면 handler 사용 (하위 호환성)
	return connection ? executeInsert(connection) : handler(executeInsert);
};

export default insert;
