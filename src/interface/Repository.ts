import { ResultSetHeader } from 'mysql2/promise';
import mysql2 from 'mysql2/promise';
import { CompareQuery, JoinType, Relations, Calculate, ColumnTypes } from './Query';
import { ExtendedResultSetHeader } from '../repository/query/insert';

// Connection 타입 정의
export type Connection = mysql2.Connection;

export interface RepositoryConfig<T> {
	table: string;
	keys: readonly string[];
	autoSetColumns?: readonly (keyof T)[];
	printQuery?: boolean;
	relations?: Relations;  // Enhanced Relations 지원
	/** 컬럼별 명시적 변환 타입. 미지정 컬럼은 기존 이름 기반 휴리스틱을 그대로 따른다. */
	columnTypes?: ColumnTypes<T>;
}

export interface ISelectQueryBuilder<T> extends PromiseLike<T[]> {
	orderBy(orderByArray: Array<{ column: keyof T; direction: 'ASC' | 'DESC' }>): ISelectQueryBuilder<T>;
	limit(limitCount: number): ISelectQueryBuilder<T>;
	offset(offsetCount: number): ISelectQueryBuilder<T>;
	join(table: string, leftColumn: string, rightColumn: string, type?: JoinType): ISelectQueryBuilder<T>;
	select(columns: string[]): ISelectQueryBuilder<T>;
	with(relationName: string): ISelectQueryBuilder<T>;
	or(condition: CompareQuery<T> | CompareQuery<T>[] | undefined): ISelectQueryBuilder<T>;
	calculate<C extends Record<string, number>>(calculates: Calculate<string & keyof C, T>[]): Promise<C>;
	execute(connection?: Connection): Promise<T[]>;
}

export interface ISelectOneQueryBuilder<T> extends PromiseLike<T | undefined> {
	orderBy(orderByArray: Array<{ column: keyof T; direction: 'ASC' | 'DESC' }>): ISelectOneQueryBuilder<T>;
	join(table: string, leftColumn: string, rightColumn: string, type?: JoinType): ISelectOneQueryBuilder<T>;
	select(columns: string[]): ISelectOneQueryBuilder<T>;
	with(relationName: string): ISelectOneQueryBuilder<T>;
	or(condition: CompareQuery<T>| CompareQuery<T>[]): ISelectOneQueryBuilder<T>;
	execute(connection?: Connection): Promise<T | undefined>;
}

export interface Repository<T, AutoSet extends keyof T = never> {
	select(query?: CompareQuery<T>, connection?: Connection): ISelectQueryBuilder<T>;
	selectOne(query: CompareQuery<T>, connection?: Connection): ISelectOneQueryBuilder<T>;
	insert(objs: Array<Omit<T, AutoSet>>, connection?: Connection): Promise<ExtendedResultSetHeader>;
	update(updates: Array<[CompareQuery<T>, Partial<Omit<T, AutoSet>>]>, connection?: Connection): Promise<ResultSetHeader>;
	delete(deletes: CompareQuery<T>[], connection?: Connection): Promise<ResultSetHeader>;
}
