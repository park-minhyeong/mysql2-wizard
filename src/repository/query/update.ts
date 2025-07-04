import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, CompareValue } from '../../interface/Query';
import { convertToSnakeString } from '../../utils';

const queryString = <T>({ table }: QueryOption<T>) => ({
	update: mysql2.format('UPDATE ?? SET ', [table]),
});

const buildWhereClause = <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>
): { conditions: string; values: unknown[] } => {
	const entries = Object.entries(query).filter(([, value]) => value !== undefined);
	const values: unknown[] = [];
	const conditions = entries.map(([key, value]) => {
		// 카멜케이스 키를 스네이크 케이스로 변환
		const snakeKey = convertToSnakeString(key);
		const val = value as CompareValue<T[keyof T]>;
		if (typeof val === 'object' && val !== null && !Array.isArray(val) && 'operator' in val && 'value' in val) {
			values.push(val.value);
			return `${mysql2.format('??', [snakeKey])} ${val.operator} ?`;
		}
		values.push(val);
		return `${mysql2.format('??', [snakeKey])} = ?`;
	}).join(' AND ');
	return { conditions, values };
};

const buildSetClause = <T>(
	obj: Partial<T>,
	option: QueryOption<T>
): { setConditions: string; setValues: unknown[] } => {
	const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
	const setValues: unknown[] = [];
	const setConditions = entries.map(([key, value]) => {
		setValues.push(value);
		return `${mysql2.format('??', [key])} = ?`;
	}).join(', ');
	return { setConditions, setValues };
};

const update = async <T>(
	query: CompareQuery<T>,
	obj: Partial<T>,
	option: QueryOption<T>
): Promise<ResultSetHeader> => handler(async connection => {
	const { conditions, values } = buildWhereClause(query, option);
	const row = option.toRow(obj as T) as Partial<T>;
	const { setConditions, setValues } = buildSetClause(row, option);
	const query_ = queryString(option).update + setConditions + ' WHERE ' + conditions;
	option.printQueryIfNeeded?.(query_);
	const [result] = await connection.query<ResultSetHeader>(query_, [...setValues, ...values]);
	return result;
});

const updateMany = async <T>(
	updates: Array<[CompareQuery<T>, Partial<T>]>,
	option: QueryOption<T>
): Promise<ResultSetHeader> => handler(async connection => {
	let totalAffectedRows = 0;

	for (const [query, obj] of updates) {
		const { conditions, values } = buildWhereClause(query, option);
		const row = option.toRow(obj as T) as Partial<T>;
		const { setConditions, setValues } = buildSetClause(row, option);
		const query_ = queryString(option).update + setConditions + ' WHERE ' + conditions;
		option.printQueryIfNeeded?.(query_);
		const [result] = await connection.query<ResultSetHeader>(query_, [...setValues, ...values]);
		totalAffectedRows += result.affectedRows;
	}

	return { affectedRows: totalAffectedRows } as ResultSetHeader;
});

export { update, updateMany };
