import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, CompareValue } from '../../interface/Query';
import { Connection } from '../../interface/Repository';
import where from './condition/where';

const queryString = <T>({ table }: QueryOption<T>) => ({
	delete: mysql2.format('DELETE FROM ?? WHERE ', [table]),
});

const delete_ = async <T>(
	queries: CompareQuery<T>[],
	option: QueryOption<T>,
	connection?: Connection
): Promise<ResultSetHeader> => {
	const executeDelete = async (conn: Connection): Promise<ResultSetHeader> => {
		let totalAffectedRows = 0;
		for (const query of queries) {
			const { conditions, values } = where(query, option);
			const query_ = queryString(option).delete + conditions;
			option.printQueryIfNeeded?.(query_);
			const [result] = await conn.query<ResultSetHeader>(query_, values);
			totalAffectedRows += result.affectedRows;
		}
		return { affectedRows: totalAffectedRows } as ResultSetHeader;
	};

	if (connection) {
		// 트랜잭션 내에서 실행 (handler 없이 직접 connection 사용)
		return executeDelete(connection);
	} else {
		// 기존 동작: handler 사용 (하위 호환성)
		return handler(async connection => {
			return executeDelete(connection);
		});
	}
};

export { delete_ };
