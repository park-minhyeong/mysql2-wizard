import { RowDataPacket } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, CompareValue } from '../../interface/Query';

const queryString = <T>({ table }: QueryOption<T>) => ({
	selectAll: mysql2.format('SELECT * FROM ??;', [table]),
	select: mysql2.format('SELECT * FROM ?? WHERE ', [table]),
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

const find = async <T>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>
): Promise<T[]> => handler(async connection => {
	if (!query || Object.keys(query).length === 0) {
		const [rows] = await connection.query<RowDataPacket[]>(queryString(option).selectAll);
		return rows.map(row => option.toObject(row));
	}
	const { conditions, values } = buildWhereClause(query, option);
	const query_ = queryString(option).select + conditions;
	option.printQueryIfNeeded?.(query_);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);
	return rows.map(row => option.toObject(row));
});

const findOne = async <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>,
	options?: { throwError?: boolean }
): Promise<T | undefined> => handler(async connection => {
	const { conditions, values } = buildWhereClause(query, option);
	const query_ = queryString(option).select + conditions;
	option.printQueryIfNeeded?.(query_);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);

	if (rows.length === 0) {
		if (options?.throwError) throw new Error('Not found');
		return undefined;
	}

	return option.toObject(rows[0]);
});

export { find, findOne };
