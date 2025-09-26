import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption } from '../../../interface/Query';
import { dbType } from '../../../config';
import { toSnakeString } from '../../../utils';
import where from '../condition/where';

export interface CountOptions<T> {
	column?: string;
	alias: string;
	case?: { when?: CompareQuery<T>; };
}

export const buildCountQuery = <T>(
	options: CountOptions<T>,
	table: string,
	baseQuery?: CompareQuery<T>,
	baseOption?: QueryOption<T>
): { query: string; values: unknown[] } => {
	const { column = '*', alias, case: caseCondition } = options;
	let values: unknown[] = [];

	// COUNT 함수 쿼리 구성
	let countQuery: string;
	
	// CASE WHEN 조건이 있는 경우
	if (caseCondition && caseCondition.when) {
		const { when } = caseCondition;
		const { conditions: whenConditions, values: whenValues } = where(when, baseOption || { table, keys: [] } as any);
		if (whenConditions.trim()) {
			const caseExpression = `CASE WHEN ${whenConditions} THEN 1 END`;
			countQuery = `COUNT(${caseExpression}) AS ${mysql2.format('??', [alias])}`;
			values = [...whenValues];
		} else {
			countQuery = `COUNT(${mysql2.format('??', [toSnakeString(column)])}) AS ${mysql2.format('??', [alias])}`;
		}
	} else {
		// 조건이 없는 경우
		if (column === '*') {
			// COUNT(*)는 특별한 문법이므로 format하지 않음
			countQuery = `COUNT(*) AS ${mysql2.format('??', [alias])}`;
		} else {
			countQuery = `COUNT(${mysql2.format('??', [toSnakeString(column)])}) AS ${mysql2.format('??', [alias])}`;
		}
	}

	return { query: countQuery, values };
};

export default buildCountQuery;
