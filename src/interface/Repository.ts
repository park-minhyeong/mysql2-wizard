import { ResultSetHeader } from 'mysql2/promise';
import { CompareQuery, QueryOption } from './Query';

export interface RepositoryConfig<T> {
	table: string;
	keys: readonly string[];
	autoSetColumns?: Array<keyof T>;
	printQuery?: boolean;
}

export interface Repository<T, AutoSet extends keyof T = never> {
	find(query?: CompareQuery<T>): Promise<T[]>;
	findOne(query: CompareQuery<T>, options?: { throwError?: boolean }): Promise<T | undefined>;
	save(obj: Omit<T, AutoSet>, option?: QueryOption<Omit<T, AutoSet>>): Promise<ResultSetHeader>;
	saveMany(objs: Array<Omit<T, AutoSet>>, option?: QueryOption<Omit<T, AutoSet>>): Promise<ResultSetHeader>;
	update(query: CompareQuery<T>, obj: Partial<Omit<T, AutoSet>>, option?: QueryOption<Omit<T, AutoSet>>): Promise<ResultSetHeader>;
	delete(query: CompareQuery<T>, option?: QueryOption<T>): Promise<ResultSetHeader>;
};
