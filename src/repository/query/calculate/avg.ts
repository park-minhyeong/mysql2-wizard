import { CompareQuery, QueryOption } from '../../../interface/Query';
import { AggregateQuery, buildAggregateQuery } from './aggregate';

export interface AvgOptions<T> {
	column: string;
	alias: string;
	case?: { when?: CompareQuery<T>; then?: number; else?: number };
}

export const buildAvgQuery = <T>(
	options: AvgOptions<T>,
	_table: string,
	_baseQuery: CompareQuery<T> | undefined,
	baseOption: QueryOption<T>
): AggregateQuery => buildAggregateQuery('AVG', options, baseOption, then => then || 1);

export default buildAvgQuery;
