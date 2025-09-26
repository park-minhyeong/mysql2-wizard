import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption } from '../../../interface/Query';
import { dbType } from '../../../config';
import { toSnakeString } from '../../../utils';
import where from '../condition/where';

export interface AvgOptions<T> {
	column: string;
	alias: string;
	case?: { when?: CompareQuery<T>; then?: number; else?: number };
}

export const buildAvgQuery = <T>(
	options: AvgOptions<T>,
	table: string,
	baseQuery?: CompareQuery<T>,
	baseOption?: QueryOption<T>
): { query: string; values: unknown[] } => {
	const { column, alias, case: caseCondition } = options;
	let values: unknown[] = [];
	let avgQuery: string;
	if (caseCondition && caseCondition.when) {
		const { when, then, else: elseValue } = caseCondition;
		const { conditions: whenConditions, values: whenValues } = where(when, baseOption || { table, keys: [] } as any);
		if (whenConditions.trim()) {
			const caseExpression = `CASE WHEN ${whenConditions} THEN ${mysql2.format('?', [then || 1])} ELSE ${mysql2.format('?', [elseValue || 0])} END`;
			avgQuery = `AVG(${caseExpression}) AS ${mysql2.format('??', [alias])}`;
			values = [...whenValues, then || 1, elseValue || 0];
		} else {
			avgQuery = `AVG(${mysql2.format('??', [toSnakeString(column)])}) AS ${mysql2.format('??', [alias])}`;
		}
	} else {
		if (dbType === 'mariadb') {
			avgQuery = `AVG(COALESCE(${mysql2.format('??', [toSnakeString(column)])}, 0)) AS ${mysql2.format('??', [alias])}`;
		} else {
			avgQuery = `AVG(${mysql2.format('??', [toSnakeString(column)])}) AS ${mysql2.format('??', [alias])}`;
		}
	}
	return { query: avgQuery, values };
};

export default buildAvgQuery;