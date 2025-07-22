import { ResultSetHeader } from 'mysql2/promise';
import { CompareQuery, QueryOption, SelectOption, JoinType, Relations } from './Query';

export interface RepositoryConfig<T> {
	table: string;
	keys: readonly string[];
	autoSetColumns?: readonly (keyof T)[];
	printQuery?: boolean;
	relations?: Relations;  // Enhanced Relations 지원 (새로 추가)
}

export interface ISelectQueryBuilder<T> extends PromiseLike<T[]> {
	orderBy(orderByArray: Array<{ column: keyof T; direction: 'ASC' | 'DESC' }>): ISelectQueryBuilder<T>;
	limit(limitCount: number): ISelectQueryBuilder<T>;
	offset(offsetCount: number): ISelectQueryBuilder<T>;
	join(table: string, leftColumn: string, rightColumn: string, type?: JoinType): ISelectQueryBuilder<T>;
	select(columns: string[]): ISelectQueryBuilder<T>;
	with(relationName: string): ISelectQueryBuilder<T>;
	execute(): Promise<T[]>;
}

export interface Repository<T, AutoSet extends keyof T = never> {
	select(query?: CompareQuery<T>): ISelectQueryBuilder<T>;
	selectOne(query: CompareQuery<T>): Promise<T | undefined>;
	selectOne(query: CompareQuery<T>, selectOptions: SelectOption<T>): Promise<T | undefined>;
	insert(objs: Array<Omit<T, AutoSet>>, option?: QueryOption<Omit<T, AutoSet>>): Promise<ResultSetHeader>;
	update(updates: Array<[CompareQuery<T>, Partial<Omit<T, AutoSet>>]>, option?: QueryOption<Omit<T, AutoSet>>): Promise<ResultSetHeader>;
	delete(query: CompareQuery<T>, option?: QueryOption<T>): Promise<ResultSetHeader>;
}
