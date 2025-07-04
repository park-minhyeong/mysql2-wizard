import { CompareQuery, QueryOption, ColumnMapping, ToRowOption } from '../interface/Query';
import { logger } from '../log';
import { find, findOne } from './query/find';
import { save, saveMany } from './query/save';
import { update, updateMany } from './query/update';
import { delete_ } from './query/delete';
import { Repository, RepositoryConfig } from '../interface/Repository';
import { convertToSnakeStrings, toRow, toObject } from '../utils';

const defaultAutoSetColumns = ['id', 'createdAt', 'updatedAt'] as const;
function repository<T, AutoSet extends keyof T = never>(
	{ table, keys, autoSetColumns, printQuery }: RepositoryConfig<T>
): Repository<T, AutoSet> {
	const printQueryIfNeeded = printQuery ? (query: string) => logger.log(`Query: ${query}`) : undefined;
	const autoSetKeys = (autoSetColumns ?? defaultAutoSetColumns).map(key => String(key));
	const queryOption: QueryOption<Omit<T, AutoSet>> = {
		table,
		keys: convertToSnakeStrings(keys),
		autoSetColumns: convertToSnakeStrings(autoSetKeys),
		printQuery,
		printQueryIfNeeded,
		toRow: (obj: Omit<T, AutoSet>, option?: ToRowOption) => toRow(keys, obj as Partial<T>, convertToSnakeStrings(autoSetKeys), option),
		toObject: (row: Record<string, unknown>) => toObject([...keys], row),
	};
	return {
		find: ((query?: CompareQuery<T>) => find(query, queryOption)) as Repository<T, AutoSet>['find'],
		findOne: ((query: CompareQuery<T>, options?: { throwError?: boolean }) => findOne(query, queryOption, options)) as Repository<T, AutoSet>['findOne'],
		save: ((obj: Omit<T, AutoSet>) => save(obj, queryOption)) as Repository<T, AutoSet>['save'],
		saveMany: ((objs: Array<Omit<T, AutoSet>>) => saveMany(objs, queryOption)) as Repository<T, AutoSet>['saveMany'],
		update: ((query: CompareQuery<T>, obj: Partial<Omit<T, AutoSet>>) => update(query, obj, queryOption)) as Repository<T, AutoSet>['update'],
		updateMany: ((updates: Array<[CompareQuery<T>, Partial<Omit<T, AutoSet>>]>) => updateMany(updates, queryOption)) as Repository<T, AutoSet>['updateMany'],
		delete: ((query: CompareQuery<T>) => delete_(query, queryOption)) as Repository<T, AutoSet>['delete'],
	};
}

export { repository }
export function rawConverter<T, U>(fromRaw: (raw: T) => U) {
	const fromRaws = (raws: T[]) => raws.map(fromRaw);
	const fromRawOrUndefined = (raw: T | undefined) => (raw ? fromRaw(raw) : undefined);
	const fromRawOrNull = (raw: T | null) => (raw ? fromRaw(raw) : null);
	return { fromRaw, fromRaws, fromRawOrUndefined, fromRawOrNull };
}
