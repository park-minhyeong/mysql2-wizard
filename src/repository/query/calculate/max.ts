import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption } from '../../../interface/Query';
import { dbType } from '../../../config';
import where from '../condition/where';

export interface MaxOptions<T> {
	column: string;
	alias: string;
	case?: { when?: CompareQuery<T>; then?: number; else?: number };
}

export const buildMaxQuery = <T>(
	options: MaxOptions<T>,
	table: string,
	baseQuery?: CompareQuery<T>,
	baseOption?: QueryOption<T>
): { query: string; values: unknown[] } => {
	const { column, alias, case: caseCondition } = options;
	let values: unknown[] = [];

	// MAX 함수 쿼리 구성
	let maxQuery: string;
	
	// CASE WHEN 조건이 있는 경우
	if (caseCondition && caseCondition.when) {
		const { when, then, else: elseValue } = caseCondition;
		const { conditions: whenConditions, values: whenValues } = where(when, baseOption || { table, keys: [] } as any);
		
		if (whenConditions.trim()) {
			const caseExpression = `CASE WHEN ${whenConditions} THEN ${mysql2.format('?', [then || 1])} ELSE ${mysql2.format('?', [elseValue || 0])} END`;
			maxQuery = `MAX(${caseExpression}) AS ${mysql2.format('??', [alias])}`;
			values = [...whenValues, then || 1, elseValue || 0];
		} else {
			maxQuery = `MAX(${mysql2.format('??', [column])}) AS ${mysql2.format('??', [alias])}`;
		}
	} else {
		// 조건이 없는 경우
		if (dbType === 'mariadb') {
			// MariaDB는 NULL 값 처리에 더 엄격할 수 있음
			maxQuery = `MAX(${mysql2.format('??', [column])}) AS ${mysql2.format('??', [alias])}`;
		} else {
			maxQuery = `MAX(${mysql2.format('??', [column])}) AS ${mysql2.format('??', [alias])}`;
		}
	}

	return { query: maxQuery, values };
};

export default buildMaxQuery;