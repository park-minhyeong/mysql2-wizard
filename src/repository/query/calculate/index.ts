import mysql2 from 'mysql2/promise';
import { RowDataPacket } from 'mysql2/promise';
import { handler } from '../../handler';
import { CompareQuery, QueryOption, Calculate, InferCalculateResult } from '../../../interface/Query';
import where from '../condition/where';
import buildSumQuery from './sum';
import buildCountQuery from './count';
import buildAvgQuery from './avg';
import buildMinQuery from './min';
import buildMaxQuery from './max';

// 오버로드 시그니처들
function calculate<T, TCalculates extends Calculate<string, any>[]>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	calculates: TCalculates
): Promise<InferCalculateResult<TCalculates>>;
function calculate<T, C extends Record<string, number>>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	calculates: Calculate<string & keyof C, any>[]
): Promise<C>;

// 실제 구현
function calculate<T, C extends Record<string, number> | Calculate<string, any>[]>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	calculates: C
): Promise<any> {
	return handler(async connection => {
	let query_: string;
	let values: unknown[] = [];

	// SELECT 절 구성 - calculate 함수들만
	const calculateParts: string[] = [];
	
	for (const calculateItem of calculates as any) {
		let calculateQuery: string;
		let calculateValues: unknown[] = [];

		switch (calculateItem.fn) {
			case 'SUM':
				const sumResult = buildSumQuery<T>(
					{ 
						column: calculateItem.column, 
						alias: calculateItem.alias, 
						case: calculateItem.case
					},
					option.table,
					query,
					option
				);
				calculateQuery = sumResult.query;
				calculateValues = sumResult.values;
				break;

			case 'COUNT':
				const countResult = buildCountQuery<T>(
					{ 
						column: calculateItem.column, 
						alias: calculateItem.alias, 
						case: calculateItem.case
					},
					option.table,
					query,
					option
				);
				calculateQuery = countResult.query;
				calculateValues = countResult.values;
				break;

			case 'AVG':
				const avgResult = buildAvgQuery<T>(
					{ 
						column: calculateItem.column || 'id', 
						alias: calculateItem.alias, 
						case: calculateItem.case
					},
					option.table,
					query,
					option
				);
				calculateQuery = avgResult.query;
				calculateValues = avgResult.values;
				break;

			case 'MIN':
				const minResult = buildMinQuery<T>(
					{ 
						column: calculateItem.column || 'id', 
						alias: calculateItem.alias, 
						case: calculateItem.case
					},
					option.table,
					query,
					option
				);
				calculateQuery = minResult.query;
				calculateValues = minResult.values;
				break;

			case 'MAX':
				const maxResult = buildMaxQuery<T>(
					{ 
						column: calculateItem.column || 'id', 
						alias: calculateItem.alias, 
						case: calculateItem.case
					},
					option.table,
					query,
					option
				);
				calculateQuery = maxResult.query;
				calculateValues = maxResult.values;
				break;

			default:
				throw new Error(`Unsupported calculate function: ${calculateItem.fn}`);
		}

		calculateParts.push(calculateQuery);
		values.push(...calculateValues);
	}

	// 기본 쿼리 구성
	query_ = `SELECT ${calculateParts.join(', ')} FROM ${mysql2.format('??', [option.table])}`;

	// 메인 WHERE 절 추가 (calculate의 조건과는 별개)
	if (query && Object.keys(query).length > 0) {
		const { conditions, values: whereValues } = where(query, option);
		if (conditions.trim()) {
			query_ += ` WHERE ${conditions}`;
			values.push(...whereValues);
		}
	}

	option.printQueryIfNeeded?.(query_);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);
	
	// 결과를 지정된 타입으로 변환
	const result = {} as C;
	if (rows.length > 0) {
		const row = rows[0];
		for (const calculateItem of calculates as any) {
			const value = row[calculateItem.alias as string];
			(result as any)[calculateItem.alias] = value !== null ? Number(value) : 0;
		}
	}
	
	return result;
	});
}

export default calculate;
