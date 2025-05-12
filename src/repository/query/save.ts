import { ResultSetHeader } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { QueryOption } from '../../interface';

const queryString = <T>({ table, columns }: { table: string, columns: readonly string[] }) => {
	return {
		insert: mysql2.format('INSERT INTO ?? (??) VALUES (?);', [table, columns]),
		insertMany: mysql2.format('INSERT INTO ?? (??) VALUES ?;', [table, columns]),
	};
};

const save = async <T>(obj: T, option: QueryOption<T>) =>
	handler(async connection => {
		const row = option.toRow(obj);
		const values: unknown[] = [];
		const columns = option.keys;
		const placeholders = columns.map((key: string) => {
			const value = row[key];
			if (option.autoSetColumns?.includes(key) && value === undefined) return 'DEFAULT';
			values.push(value);
			return '?';
		}).join(', ');
		const query = queryString({ table: option.table, columns }).insert.replace('?', placeholders);
		option.printQueryIfNeeded?.(query);
		const [result] = await connection.query<ResultSetHeader>(query, values);
		return result;
	});

const saveMany = async <T>(objs: T[], option: QueryOption<T>) =>
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
		return result;
	});

export { save, saveMany };
