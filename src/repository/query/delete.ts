import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption } from '../../interface/Query';
import { Connection } from '../../interface/Repository';
import where from './condition/where';

/** 단일 DELETE 문과 바인딩 값. */
export const buildDeleteQuery = <T>(query: CompareQuery<T>, option: QueryOption<T>): { sql: string; params: unknown[] } => {
	const { conditions, values } = where(query, option);
	return { sql: mysql2.format('DELETE FROM ?? WHERE ', [option.table]) + conditions, params: values };
};

const delete_ = async <T>(
	queries: CompareQuery<T>[],
	option: QueryOption<T>,
	connection?: Connection
): Promise<ResultSetHeader> => {
	const executeDelete = async (conn: Connection): Promise<ResultSetHeader> => {
		let totalAffectedRows = 0;
		for (const query of queries) {
			const { sql, params } = buildDeleteQuery(query, option);
			option.printQueryIfNeeded?.(sql);
			const [result] = await conn.query<ResultSetHeader>(sql, params);
			totalAffectedRows += result.affectedRows;
		}
		return { affectedRows: totalAffectedRows } as ResultSetHeader; // 합산 결과만 의미 있음
	};

	// connection이 제공되면 트랜잭션 내에서 직접 실행, 없으면 handler 사용 (하위 호환성)
	return connection ? executeDelete(connection) : handler(executeDelete);
};

export { delete_ };
