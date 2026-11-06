import mysql2 from 'mysql2/promise';
import { RowDataPacket } from 'mysql2/promise';
import { handler } from '../../handler';
import { CompareQuery, QueryOption, Calculate, InferCalculateResult, SelectOption } from '../../../interface/Query';
import where from '../condition/where';
import buildSumQuery from './sum';
import buildCountQuery from './count';
import buildAvgQuery from './avg';
import buildMinQuery from './min';
import buildMaxQuery from './max';
import { AggregateQuery } from './aggregate';

const buildCalculatePart = <T>(item: Calculate<string, T>, query: CompareQuery<T> | undefined, option: QueryOption<T>): AggregateQuery => {
	const alias = item.alias;
	switch (item.fn) {
		case 'SUM':
			return buildSumQuery<T>({ column: item.column === undefined ? undefined : String(item.column), alias, case: item.case }, option.table, query, option);
		case 'COUNT':
			return buildCountQuery<T>({ column: item.column === undefined ? undefined : String(item.column), alias, case: item.case }, option.table, query, option);
		case 'AVG':
			return buildAvgQuery<T>({ column: String(item.column || 'id'), alias, case: item.case }, option.table, query, option);
		case 'MIN':
			return buildMinQuery<T>({ column: String(item.column || 'id'), alias, case: item.case }, option.table, query, option);
		case 'MAX':
			return buildMaxQuery<T>({ column: String(item.column || 'id'), alias, case: item.case }, option.table, query, option);
		default: {
			const unknown: never = item;
			throw new Error(`Unsupported calculate function: ${(unknown as Calculate<string, T>).fn}`);
		}
	}
};

/** `SELECT <aggregates> FROM table [WHERE ...]` 와 바인딩 값 (집계 CASE 값 → WHERE 값 순). */
export const buildCalculateQuery = <T>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	calculates: ReadonlyArray<Calculate<string, T>>,
	selectOptions?: SelectOption<T>
): { sql: string; values: unknown[] } => {
	const values: unknown[] = [];
	const parts: string[] = [];
	for (const item of calculates) {
		const built = buildCalculatePart(item, query, option);
		parts.push(built.query);
		values.push(...built.values);
	}

	let sql = `SELECT ${parts.join(', ')} FROM ${mysql2.format('??', [option.table])}`;
	const { conditions, values: whereValues } = where(query ?? {}, option, selectOptions?.orConditions);
	if (conditions.trim()) {
		sql += ` WHERE ${conditions}`;
		values.push(...whereValues);
	}
	return { sql, values };
};

// 오버로드 시그니처들
function calculate<T, TCalculates extends Calculate<string, T>[]>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	calculates: TCalculates,
	selectOptions?: SelectOption<T>
): Promise<InferCalculateResult<TCalculates>>;
function calculate<T, C extends Record<string, number>>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	calculates: Calculate<string & keyof C, T>[],
	selectOptions?: SelectOption<T>
): Promise<C>;

// 실제 구현
function calculate<T>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	calculates: Calculate<string, T>[],
	selectOptions?: SelectOption<T>
): Promise<Record<string, number>> {
	return handler(async connection => {
		const { sql, values } = buildCalculateQuery(query, option, calculates, selectOptions);
		option.printQueryIfNeeded?.(sql);
		const [rows] = await connection.query<RowDataPacket[]>(sql, values);

		// 결과를 alias → number 로 변환 (NULL은 0)
		const result: Record<string, number> = {};
		if (rows.length > 0) {
			const row = rows[0];
			for (const item of calculates) {
				const value: unknown = row[item.alias];
				result[item.alias] = value !== null ? Number(value) : 0;
			}
		}
		return result;
	});
}

export default calculate;
