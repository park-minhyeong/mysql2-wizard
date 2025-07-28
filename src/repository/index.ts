import { CompareQuery, QueryOption, ToRowOption, SelectOption } from '../interface/Query';
import { logger } from '../log';
import { select, selectOne, SelectQueryBuilder, SelectOneQueryBuilder } from './query/select';
import insert from './query/insert';
import { update } from './query/update';
import { delete_ } from './query/delete';
import { Repository, RepositoryConfig } from '../interface/Repository';
import { convertToSnakeStrings, toRow, toObject } from '../utils';

const defaultAutoSetColumns = ['id', 'createdAt', 'updatedAt'] as const;
function repository<T, AutoSet extends keyof T = never>(
	{ table, keys, autoSetColumns, printQuery, relations }: RepositoryConfig<T>
): Repository<T, AutoSet> {
	const printQueryIfNeeded = printQuery ? (query: string) => logger.log(`Query: ${query}`) : undefined;
	const autoSetKeys = (autoSetColumns ?? defaultAutoSetColumns).map(key => String(key));
	const stringKeys = keys.map(key => String(key));
	const queryOption: QueryOption<T> = {
		table,
		keys: convertToSnakeStrings(stringKeys),
		autoSetColumns: convertToSnakeStrings(autoSetKeys),
		printQuery,
		printQueryIfNeeded,
		toRow: (obj: T, option?: ToRowOption) => toRow(stringKeys, obj as Partial<T>, convertToSnakeStrings(autoSetKeys), option),
		toObject: (row: Record<string, unknown>) => toObject([...stringKeys], row),
		relations  // Enhanced Relations 지원 (새로 추가)
	};
	return {
		// 체이닝 패턴: select(query).orderBy().limit().execute()
		select: ((query?: CompareQuery<T>) => new SelectQueryBuilder(query, queryOption as unknown as QueryOption<T>)) as Repository<T, AutoSet>['select'],
		selectOne: ((query: CompareQuery<T>) => new SelectOneQueryBuilder(query, queryOption as unknown as QueryOption<T>)) as Repository<T, AutoSet>['selectOne'],
		insert: ((objs: Array<Omit<T, AutoSet>>) => insert(objs, queryOption as unknown as QueryOption<Omit<T, AutoSet>>)) as Repository<T, AutoSet>['insert'],
		update: ((updates: Array<[CompareQuery<T>, Partial<Omit<T, AutoSet>>]>) => update(updates, queryOption as unknown as QueryOption<Omit<T, AutoSet>>)) as Repository<T, AutoSet>['update'],
		delete: ((deletes: CompareQuery<T>[]) => delete_(deletes, queryOption as unknown as QueryOption<T>)) as Repository<T, AutoSet>['delete'],
	};
}

export { repository }
export function rawConverter<T, U>(fromRaw: (raw: T) => U) {
	const fromRaws = (raws: T[]) => raws.map(fromRaw);
	const fromRawOrUndefined = (raw: T | undefined) => (raw ? fromRaw(raw) : undefined);
	const fromRawOrNull = (raw: T | null) => (raw ? fromRaw(raw) : null);
	return { fromRaw, fromRaws, fromRawOrUndefined, fromRawOrNull };
}
