import { CompareQuery, QueryOption, ToRowOption, ColumnType } from '../interface/Query';
import { logger } from '../log';
import { SelectQueryBuilder, SelectOneQueryBuilder } from './query/select';
import insert from './query/insert';
import { update } from './query/update';
import { delete_ } from './query/delete';
import { Repository, RepositoryConfig, Connection } from '../interface/Repository';
import { convertToSnakeStrings, toRow, toObject } from '../utils';

const defaultAutoSetColumns = ['id', 'createdAt', 'updatedAt'] as const;

function repository<T, AutoSet extends keyof T = never>(
	{ table, keys, autoSetColumns, printQuery, relations, columnTypes }: RepositoryConfig<T>
): Repository<T, AutoSet> {
	const printQueryIfNeeded = printQuery ? (query: string) => logger.log(`Query: ${query}`) : undefined;
	const autoSetKeys = (autoSetColumns ?? defaultAutoSetColumns).map(key => String(key));
	const snakeAutoSetKeys = convertToSnakeStrings(autoSetKeys);
	const stringKeys = keys.map(key => String(key));
	// ColumnTypes<T>는 keyof T 키이므로 문자열 맵으로 한 번만 정규화
	const columnTypeMap = columnTypes as Record<string, ColumnType | undefined> | undefined;
	const queryOption: QueryOption<T> = {
		table,
		keys: convertToSnakeStrings(stringKeys),
		autoSetColumns: snakeAutoSetKeys,
		printQuery,
		printQueryIfNeeded,
		toRow: (obj: Partial<T>, option?: ToRowOption) => toRow(stringKeys, obj, snakeAutoSetKeys, option, columnTypeMap),
		toObject: (row: Record<string, unknown>) => toObject<T>(stringKeys, row, columnTypeMap),
		relations,
	};
	return {
		// 체이닝 패턴: select(query, connection?).orderBy().limit().execute(connection?)
		select: (query?: CompareQuery<T>, connection?: Connection) =>
			new SelectQueryBuilder<T>(query, queryOption, connection),
		selectOne: (query: CompareQuery<T>, connection?: Connection) =>
			new SelectOneQueryBuilder<T>(query, queryOption, connection),
		// Omit<T, AutoSet>은 구조적으로 Partial<T>의 부분집합이지만 TS가 제네릭에서 증명하지 못해 한 번 넓힌다
		insert: (objs: Array<Omit<T, AutoSet>>, connection?: Connection) =>
			insert<T>(objs as Partial<T>[], queryOption, connection),
		update: (updates: Array<[CompareQuery<T>, Partial<Omit<T, AutoSet>>]>, connection?: Connection) =>
			update<T>(updates as Array<[CompareQuery<T>, Partial<T>]>, queryOption, connection),
		delete: (deletes: CompareQuery<T>[], connection?: Connection) =>
			delete_<T>(deletes, queryOption, connection),
	};
}

export { repository }
export function rawConverter<T, U>(fromRaw: (raw: T) => U) {
	const fromRaws = (raws: T[]) => raws.map(fromRaw);
	const fromRawOrUndefined = (raw: T | undefined) => (raw ? fromRaw(raw) : undefined);
	const fromRawOrNull = (raw: T | null) => (raw ? fromRaw(raw) : null);
	return { fromRaw, fromRaws, fromRawOrUndefined, fromRawOrNull };
}
