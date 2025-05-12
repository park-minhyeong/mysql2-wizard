import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, CompareValue } from '../../interface/Query';

const queryString = <T>({ table }: QueryOption<T>) => ({
	delete: mysql2.format('DELETE FROM ?? WHERE ', [table]),
});

const buildWhereClause = <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>
): { conditions: string; values: unknown[] } => {
	const entries = Object.entries(query).filter(([, value]) => value !== undefined);
	const values: unknown[] = [];
	const conditions = entries.map(([key, value]) => {
		const val = value as CompareValue<T[keyof T]>;
		if (typeof val === 'object' && val !== null && !Array.isArray(val) && 'operator' in val && 'value' in val) {
			values.push(val.value);
			return `${mysql2.format('??', [key])} ${val.operator} ?`;
		}
		values.push(val);
		return `${mysql2.format('??', [key])} = ?`;
	}).join(' AND ');
	return { conditions, values };
};

const delete_ = async <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>
): Promise<ResultSetHeader> => handler(async connection => {
	const { conditions, values } = buildWhereClause(query, option);
	const query_ = queryString(option).delete + conditions;
	option.printQueryIfNeeded?.(query_);
	const [result] = await connection.query<ResultSetHeader>(query_, values);
	return result;
});

export { delete_ };
