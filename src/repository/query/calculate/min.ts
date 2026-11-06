import { CompareQuery, QueryOption } from '../../../interface/Query';
import { AggregateQuery, buildAggregateQuery } from './aggregate';

export interface MinOptions<T> {
	column: string;
	alias: string;
	case?: { when?: CompareQuery<T>; then?: number; else?: number };
}

export const buildMinQuery = <T>(
	options: MinOptions<T>,
	_table: string,
	_baseQuery: CompareQuery<T> | undefined,
	baseOption: QueryOption<T>
): AggregateQuery => buildAggregateQuery('MIN', options, baseOption, then => then || 1);

export default buildMinQuery;
