import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption } from '../../../interface/Query';
import { toSnakeString } from '../../../utils';
import where from '../condition/where';
import { AggregateQuery } from './aggregate';

export interface CountOptions<T> {
	column?: string;
	alias: string;
	case?: { when?: CompareQuery<T>; };
}

export const buildCountQuery = <T>(
	options: CountOptions<T>,
	_table: string,
	_baseQuery: CompareQuery<T> | undefined,
	baseOption: QueryOption<T>
): AggregateQuery => {
	const { column = '*', alias, case: caseCondition } = options;
	const aliasSql = mysql2.format('??', [alias]);

	if (caseCondition?.when) {
		const { conditions, values } = where(caseCondition.when, baseOption);
		if (conditions.trim()) {
			return { query: `COUNT(CASE WHEN ${conditions} THEN 1 END) AS ${aliasSql}`, values };
		}
		return { query: `COUNT(${mysql2.format('??', [toSnakeString(column)])}) AS ${aliasSql}`, values: [] };
	}

	// COUNT(*)는 특별한 문법이므로 format하지 않음
	if (column === '*') return { query: `COUNT(*) AS ${aliasSql}`, values: [] };
	return { query: `COUNT(${mysql2.format('??', [toSnakeString(column)])}) AS ${aliasSql}`, values: [] };
};

export default buildCountQuery;
