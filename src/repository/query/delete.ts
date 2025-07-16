import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, CompareValue } from '../../interface/Query';
import where from './condition/where';

const queryString = <T>({ table }: QueryOption<T>) => ({
	delete: mysql2.format('DELETE FROM ?? WHERE ', [table]),
});

const delete_ = async <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>
): Promise<ResultSetHeader> => handler(async connection => {
	const { conditions, values } = where(query, option);
	const query_ = queryString(option).delete + conditions;
	option.printQueryIfNeeded?.(query_);
	const [result] = await connection.query<ResultSetHeader>(query_, values);
	return result;
});

export { delete_ };
