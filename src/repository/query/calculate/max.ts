import { CompareQuery, QueryOption } from '../../../interface/Query';
import { AggregateQuery, buildAggregateQuery } from './aggregate';

export interface MaxOptions<T> {
	column: string;
	alias: string;
	case?: { when?: CompareQuery<T>; then?: number; else?: number };
}

export const buildMaxQuery = <T>(
	options: MaxOptions<T>,
	_table: string,
	_baseQuery: CompareQuery<T> | undefined,
	baseOption: QueryOption<T>
): AggregateQuery => buildAggregateQuery('MAX', options, baseOption, then => then || 1);

export default buildMaxQuery;
