import { CompareQuery, QueryOption, ColumnMapping } from '../interface/Query';
import { logger } from '../log';
import { find, findOne } from './query/find';
import { save, saveMany } from './query/save';
import { update } from './query/update';
import { delete_ } from './query/delete';
import { Repository, RepositoryConfig } from '../interface/Repository';
import { convertToSnakeStrings, toObject, toRow } from '../utils';

function repository<T, AutoSet extends keyof T = never>(
	{ table, keys, autoSetColumns, printQuery }: RepositoryConfig<T>
): Repository<T, AutoSet> {
	const printQueryIfNeeded = printQuery ? (query: string) => logger.log(`Query: ${query}`) : undefined;
	const autoSetKeys = (autoSetColumns ?? []).map(key => String(key));
	const queryOption: QueryOption<Omit<T, AutoSet>> = {
		table,
		keys: convertToSnakeStrings(keys),
		autoSetColumns: convertToSnakeStrings(autoSetKeys),
		printQuery,
		printQueryIfNeeded,
		toRow: (obj: Omit<T, AutoSet>) => {
			const row = {} as Record<string, unknown>;
			keys.forEach((key) => {
				if (autoSetKeys.includes(String(key))) {
					row[convertToSnakeStrings([key])[0]] = undefined;
				} else {
					row[convertToSnakeStrings([key])[0]] = obj[key as keyof typeof obj];
				}
			});
			return row;
		},
		toObject: (row: Record<string, unknown>) => {
			const snakeKeys = convertToSnakeStrings([...keys]);
			const result = {} as Record<string, unknown>;
			keys.forEach((key, i) => {
				result[key] = row[snakeKeys[i]];
			});
			return result as Omit<T, AutoSet>;
		},
	};
	return {
		find: ((query?: CompareQuery<T>) => find(query, queryOption)) as Repository<T, AutoSet>['find'],
		findOne: ((query: CompareQuery<T>, options?: { throwError?: boolean }) => findOne(query, queryOption, options)) as Repository<T, AutoSet>['findOne'],
		save: ((obj: Omit<T, AutoSet>) => save(obj, queryOption)) as Repository<T, AutoSet>['save'],
		saveMany: ((objs: Array<Omit<T, AutoSet>>) => saveMany(objs, queryOption)) as Repository<T, AutoSet>['saveMany'],
		update: ((query: CompareQuery<T>, obj: Partial<Omit<T, AutoSet>>) => update(query, obj, queryOption)) as Repository<T, AutoSet>['update'],
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
