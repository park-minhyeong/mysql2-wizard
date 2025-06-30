import { RowDataPacket } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption } from '../../interface/Query';

const queryString = <T>({ table }: QueryOption<T>) => ({
	selectAll: mysql2.format('SELECT * FROM ??;', [table]),
	select: mysql2.format('SELECT * FROM ?? WHERE ', [table]),
});

const buildWhereClause = <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>
): { conditions: string; values: unknown[] } => {
	const row = option.toRow(query as T,{isAutoSet:false});
	const entries = Object.entries(row).filter(([, value]) => value !== undefined);
	const values: unknown[] = [];
	const conditions = entries.map(([columnName, value]) => {
		const originalValue = query[columnName as keyof T];
		if (typeof originalValue === 'object' && originalValue !== null) {
			if (Array.isArray(originalValue)) {
				const arrayConditions = originalValue.map(val => {
					values.push(val);
					return mysql2.format('?? = ?', [columnName, val]);
				}).join(' OR ');
				return `(${arrayConditions})`;
			} else if ('operator' in originalValue && 'value' in originalValue) {
				values.push(originalValue.value);
				return mysql2.format('?? ' + originalValue.operator + ' ?', [columnName, originalValue.value]);
			}
		}
		values.push(value);
		return mysql2.format('?? = ?', [columnName, value]);
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
	const query_with_values = mysql2.format(query_, values);
	option.printQueryIfNeeded?.(query_with_values);
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
	const query_with_values = mysql2.format(query_, values);
	option.printQueryIfNeeded?.(query_with_values);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);
	if (rows.length === 0) {
		if (options?.throwError) throw new Error('Not found');
		return undefined;
	}
	return option.toObject(rows[0]);
});

export { find, findOne };
