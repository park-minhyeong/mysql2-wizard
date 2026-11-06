import { CompareQuery, QueryOption } from '../../../interface/Query';
import { AggregateQuery, buildAggregateQuery } from './aggregate';

export interface SumOptions<T> {
	column?: string;
	alias: string;
	case?: { when?: CompareQuery<T>; then?: number; else?: number };
}

// SUM은 then=0도 그대로 사용한다 (미지정 시 1)
export const buildSumQuery = <T>(
	options: SumOptions<T>,
	_table: string,
	_baseQuery: CompareQuery<T> | undefined,
	baseOption: QueryOption<T>
): AggregateQuery => buildAggregateQuery('SUM', options, baseOption, then => (typeof then !== 'undefined' ? then : 1));

export default buildSumQuery;
