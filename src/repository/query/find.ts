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

interface LikeOptions<T> {
	like?: CompareQuery<T>;
	likeFront?: CompareQuery<T>;
	likeBack?: CompareQuery<T>;
}

const buildLikeClause = <T>(
	likeOptions: LikeOptions<T>,
	option: QueryOption<T>
): { conditions: string; values: unknown[] } => {
	const allConditions: string[] = [];
	const allValues: unknown[] = [];

	Object.entries(likeOptions).forEach(([type, query]) => {
		if (!query) return;
		const row = option.toRow(query as T, { isAutoSet: false });
		Object.entries(row).forEach(([columnName, value]) => {
			if (value === undefined) return;
			let likeValue: string;
			switch (type) {
				case 'like':
					likeValue = `%${value}%`;
					break;
				case 'likeFront':
					likeValue = `%${value}`;
					break;
				case 'likeBack':
					likeValue = `${value}%`;
					break;
				default:
					return;
			}
			allValues.push(likeValue);
			allConditions.push(mysql2.format('?? LIKE ?', [columnName, likeValue]));
		});
	});

	return {
		conditions: allConditions.join(' AND '),
		values: allValues
	};
};

const find = async <T>(
	query: (CompareQuery<T> & LikeOptions<T>) | undefined,
	option: QueryOption<T>
): Promise<T[]> => handler(async connection => {
	if (!query || Object.keys(query).length === 0) {
		const [rows] = await connection.query<RowDataPacket[]>(queryString(option).selectAll);
		return rows.map(row => option.toObject(row));
	}

	const conditions: string[] = [];
	const values: unknown[] = [];

	// Handle regular conditions
	const regularQuery: CompareQuery<T> = {};
	Object.entries(query).forEach(([key, value]) => {
		if (!['like', 'likeFront', 'likeBack'].includes(key)) {
			(regularQuery as any)[key] = value;
		}
	});

	if (Object.keys(regularQuery).length > 0) {
		const { conditions: regularConditions, values: regularValues } = buildWhereClause(regularQuery, option);
		if (regularConditions) {
			conditions.push(regularConditions);
			values.push(...regularValues);
		}
	}

	// Handle LIKE conditions
	const likeOptions: LikeOptions<T> = {
		like: query.like,
		likeFront: query.likeFront,
		likeBack: query.likeBack
	};

	if (Object.values(likeOptions).some(v => v !== undefined)) {
		const { conditions: likeConditions, values: likeValues } = buildLikeClause(likeOptions, option);
		if (likeConditions) {
			conditions.push(likeConditions);
			values.push(...likeValues);
		}
	}

	const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
	const query_ = queryString(option).select + whereClause;
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
