import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption } from '../../../interface/Query';
import { dbType } from '../../../core/pool';
import { toSnakeString } from '../../../utils';
import where from '../condition/where';

export interface AggregateCase<T> {
	when?: CompareQuery<T>;
	then?: number;
	else?: number;
}

export interface AggregateOptions<T> {
	column?: string;
	alias: string;
	case?: AggregateCase<T>;
}

export interface AggregateQuery {
	query: string;
	values: unknown[];
}

type AggregateFn = 'SUM' | 'AVG' | 'MIN' | 'MAX';

/** MariaDB는 SUM/AVG의 NULL 처리를 위해 COALESCE로 감싼다. */
const COALESCE_ON_MARIADB: ReadonlySet<AggregateFn> = new Set(['SUM', 'AVG']);

/**
 * SUM/AVG/MIN/MAX 공통 빌더.
 * CASE WHEN이 있으면 `FN(CASE WHEN <cond> THEN <then> ELSE <else> END)`; then/else는 리터럴로 인라인되므로 바인딩은 when 조건 값만 포함한다.
 */
export const buildAggregateQuery = <T>(
	fn: AggregateFn,
	options: AggregateOptions<T>,
	baseOption: QueryOption<T>,
	thenLiteral: (then: number | undefined) => number
): AggregateQuery => {
	const { column = '*', alias, case: caseCondition } = options;
	const aliasSql = mysql2.format('??', [alias]);
	const columnSql = mysql2.format('??', [toSnakeString(column)]);

	if (caseCondition?.when) {
		const { when, then, else: elseValue } = caseCondition;
		const { conditions, values } = where(when, baseOption);
		if (conditions.trim()) {
			const caseExpression = `CASE WHEN ${conditions} THEN ${mysql2.format('?', [thenLiteral(then)])} ELSE ${mysql2.format('?', [elseValue || 0])} END`;
			return { query: `${fn}(${caseExpression}) AS ${aliasSql}`, values };
		}
		return { query: `${fn}(${columnSql}) AS ${aliasSql}`, values: [] };
	}

	if (dbType === 'mariadb' && COALESCE_ON_MARIADB.has(fn)) {
		return { query: `${fn}(COALESCE(${columnSql}, 0)) AS ${aliasSql}`, values: [] };
	}
	return { query: `${fn}(${columnSql}) AS ${aliasSql}`, values: [] };
};
