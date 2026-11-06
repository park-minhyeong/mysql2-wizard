import { RowDataPacket } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, SelectOption, OrderBy, JoinType, JoinClause, Relation, Relations, Calculate } from '../../interface/Query';
import { ISelectQueryBuilder, ISelectOneQueryBuilder, Connection } from '../../interface/Repository';
import calculate from './calculate';
import where from './condition/where';
import orderBy from './option/orderBy';
import limit from './option/limit';
import buildJoinClause, { buildRelationJoins } from './relation/join';
import buildSelectClause from './select.support';
import { convertToSnakeString, toObject } from '../../utils';

type Row = Record<string, unknown>;

/** 조인 테이블 컬럼 별칭: `<table>__<snake_column>` (메인 테이블과의 이름 충돌 방지) */
const relationAlias = (relation: Relation, key: string) => `${relation.table}__${convertToSnakeString(key)}`;

/** SELECT 컬럼 목록. 명시 컬럼 > keys 기반 (+ with() 관계 테이블의 별칭 컬럼). */
const buildSelectColumns = <T>(option: QueryOption<T>, selectOptions?: SelectOption<T>): string => {
	if (selectOptions?.selectColumns && selectOptions.selectColumns.length > 0) {
		return buildSelectClause(selectOptions.selectColumns, option.table);
	}
	const table = mysql2.format('??', [option.table]);
	const parts: string[] = option.keys.length > 0
		? option.keys.map(key => `${table}.${mysql2.format('??', [key])}`)
		: [`${table}.*`];

	if (selectOptions?.withRelations && option.relations) {
		for (const relationName of selectOptions.withRelations) {
			const relation = option.relations[relationName];
			if (!relation) continue;
			const relationTable = mysql2.format('??', [relation.table]);
			if (relation.keys && relation.keys.length > 0) {
				for (const key of relation.keys) {
					const snakeKey = convertToSnakeString(String(key));
					parts.push(`${relationTable}.${mysql2.format('??', [snakeKey])} AS ${mysql2.format('??', [relationAlias(relation, String(key))])}`);
				}
			} else {
				parts.push(`${relationTable}.*`);
			}
		}
	}
	return parts.join(', ');
};

/** SELECT ... FROM ... JOIN ... WHERE ... ORDER BY ... + tail(LIMIT/OFFSET 또는 LIMIT 1) */
export const buildSelectQuery = <T>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	selectOptions: SelectOption<T> | undefined,
	tail: string
): { sql: string; values: unknown[] } => {
	let sql = `SELECT ${buildSelectColumns(option, selectOptions)} FROM ${mysql2.format('??', [option.table])}`;

	// JOIN 절 (수동 join + with() 관계 조인), WHERE 절보다 먼저
	const relationJoins = buildRelationJoins(selectOptions?.withRelations, option.relations, option.table);
	sql += buildJoinClause([...(selectOptions?.joins ?? []), ...relationJoins]);

	const { conditions, values } = where(query ?? {}, option, selectOptions?.orConditions);
	if (conditions.trim()) sql += ` WHERE ${conditions}`;

	sql += orderBy(selectOptions?.orderBy);
	sql += tail;
	return { sql, values: conditions.trim() ? values : [] };
};

/** 별칭 컬럼에서 관계 데이터를 꺼낸다. 전부 NULL(LEFT JOIN 미매칭)이면 null. keys 없는 관계는 undefined(매핑 불가). */
const extractRelation = (row: Row, relation: Relation): Row | null | undefined => {
	if (!relation.keys) return undefined;
	const relationRow: Row = {};
	let hasData = false;
	for (const key of relation.keys) {
		const value = row[relationAlias(relation, String(key))];
		relationRow[convertToSnakeString(String(key))] = value;
		if (value !== undefined && value !== null) hasData = true;
	}
	if (!hasData) return null;
	return toObject<Row>([...relation.keys], relationRow, relation.columnTypes);
};

/** 행 하나를 메인 객체 + 중첩 관계(hasOne/belongsTo: 객체|null)로 변환. hasMany 없는 경우 전용. */
const mapRowWithRelations = <T>(row: Row, option: QueryOption<T>, withRelations: string[], relations: Relations): Row => {
	const result: Row = Object.assign<Row, T>({}, option.toObject(row));
	for (const relationName of withRelations) {
		const relation = relations[relationName];
		if (!relation) continue;
		const data = extractRelation(row, relation);
		if (data !== undefined) result[relationName] = data;
	}
	return result;
};

/** hasMany 포함 시 메인 레코드 기준으로 그룹화하고 관계를 배열/객체로 채운다. */
const groupRowsWithRelations = <T>(rows: Row[], option: QueryOption<T>, withRelations: string[], relations: Relations): Row[] => {
	const grouped = new Map<string, Row>();
	for (const row of rows) {
		const mainData = option.toObject(row);
		const mainKey = JSON.stringify(mainData);
		let record = grouped.get(mainKey);
		if (!record) {
			const created: Row = Object.assign<Row, T>({}, mainData);
			for (const relationName of withRelations) {
				const relation = relations[relationName];
				if (relation) created[relationName] = relation.type === 'hasMany' ? [] : null;
			}
			grouped.set(mainKey, created);
			record = created;
		}
		for (const relationName of withRelations) {
			const relation = relations[relationName];
			if (!relation) continue;
			const data = extractRelation(row, relation);
			if (data === undefined || data === null) continue;
			if (relation.type === 'hasMany') {
				const list = record[relationName];
				if (Array.isArray(list)) {
					const serialized = JSON.stringify(data);
					if (!list.some(item => JSON.stringify(item) === serialized)) list.push(data);
				}
			} else {
				record[relationName] = data;
			}
		}
	}
	return Array.from(grouped.values());
};

/** with()가 쓰였으면 중첩 구조로, 아니면 단순 toObject. */
const mapRows = <T>(rows: Row[], option: QueryOption<T>, selectOptions?: SelectOption<T>): T[] => {
	const withRelations = selectOptions?.withRelations;
	if (withRelations && withRelations.length > 0 && option.relations) {
		const relations = option.relations;
		const hasMany = withRelations.some(name => relations[name]?.type === 'hasMany');
		const mapped = hasMany
			? groupRowsWithRelations(rows, option, withRelations, relations)
			: rows.map(row => mapRowWithRelations(row, option, withRelations, relations));
		return mapped as T[]; // 관계가 중첩된 객체는 T를 구조적으로 확장한다
	}
	return rows.map(row => option.toObject(row));
};

// 체이닝 패턴 구현
export class SelectQueryBuilder<T> implements ISelectQueryBuilder<T> {
	private selectOptions: SelectOption<T> = {};
	private joinClauses: JoinClause[] = [];
	private withRelations: string[] = [];
	private connection?: Connection;

	constructor(
		private query: CompareQuery<T> | undefined,
		private option: QueryOption<T>,
		connection?: Connection
	) {
		this.connection = connection;
	}

	orderBy(orderByArray: OrderBy<T>): ISelectQueryBuilder<T> {
		this.selectOptions.orderBy = orderByArray;
		return this;
	}

	limit(limitCount: number): ISelectQueryBuilder<T> {
		this.selectOptions.limit = limitCount;
		return this;
	}

	offset(offsetCount: number): ISelectQueryBuilder<T> {
		this.selectOptions.offset = offsetCount;
		return this;
	}

	join(table: string, leftColumn: string, rightColumn: string, type: JoinType = 'INNER'): ISelectQueryBuilder<T> {
		this.joinClauses.push({ table, leftColumn, rightColumn, type });
		this.selectOptions.joins = this.joinClauses;
		return this;
	}

	select(columns: string[]): ISelectQueryBuilder<T> {
		this.selectOptions.selectColumns = columns;
		return this;
	}

	with(relationName: string): ISelectQueryBuilder<T> {
		this.withRelations.push(relationName);
		this.selectOptions.withRelations = this.withRelations;
		return this;
	}

	or(condition: CompareQuery<T> | CompareQuery<T>[] | undefined): ISelectQueryBuilder<T> {
		if (condition !== undefined) {
			this.selectOptions.orConditions ??= [];
			this.selectOptions.orConditions.push(...(Array.isArray(condition) ? condition : [condition]));
		}
		return this;
	}

	calculate<C extends Record<string, number>>(calculates: Calculate<string & keyof C, T>[]): Promise<C> {
		return calculate<T, C>(this.query, this.option, calculates, this.selectOptions);
	}

	async execute(connection?: Connection): Promise<T[]> {
		// 우선순위: 파라미터 > 생성자에 저장된 connection
		return select(this.query, this.option, this.selectOptions, connection ?? this.connection);
	}

	// PromiseLike 구현 - await를 어디서든 사용 가능
	then<TResult1 = T[], TResult2 = never>(
		onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

// SelectOne용 체이닝 패턴 구현
export class SelectOneQueryBuilder<T> implements ISelectOneQueryBuilder<T> {
	private selectOptions: SelectOption<T> = {};
	private joinClauses: JoinClause[] = [];
	private withRelations: string[] = [];
	private connection?: Connection;

	constructor(
		private query: CompareQuery<T>,
		private option: QueryOption<T>,
		connection?: Connection
	) {
		this.connection = connection;
	}

	orderBy(orderByArray: OrderBy<T>): ISelectOneQueryBuilder<T> {
		this.selectOptions.orderBy = orderByArray;
		return this;
	}

	join(table: string, leftColumn: string, rightColumn: string, type: JoinType = 'INNER'): ISelectOneQueryBuilder<T> {
		this.joinClauses.push({ table, leftColumn, rightColumn, type });
		this.selectOptions.joins = this.joinClauses;
		return this;
	}

	select(columns: string[] | string): ISelectOneQueryBuilder<T> {
		this.selectOptions.selectColumns = Array.isArray(columns) ? columns : [columns];
		return this;
	}

	with(relationName: string): ISelectOneQueryBuilder<T> {
		this.withRelations.push(relationName);
		this.selectOptions.withRelations = this.withRelations;
		return this;
	}

	or(condition: CompareQuery<T> | CompareQuery<T>[] | undefined): ISelectOneQueryBuilder<T> {
		if (condition !== undefined) {
			this.selectOptions.orConditions ??= [];
			this.selectOptions.orConditions.push(...(Array.isArray(condition) ? condition : [condition]));
		}
		return this;
	}

	async execute(connection?: Connection): Promise<T | undefined> {
		return selectOne(this.query, this.option, undefined, this.selectOptions, connection ?? this.connection);
	}

	then<TResult1 = T | undefined, TResult2 = never>(
		onfulfilled?: ((value: T | undefined) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

const select = async <T>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	selectOptions?: SelectOption<T>,
	connection?: Connection
): Promise<T[]> => {
	const executeSelect = async (conn: Connection): Promise<T[]> => {
		const { sql, values } = buildSelectQuery(query, option, selectOptions, limit(selectOptions));
		option.printQueryIfNeeded?.(sql);
		const [rows] = await conn.query<RowDataPacket[]>(sql, values);
		return mapRows(rows, option, selectOptions);
	};

	// connection이 제공되면 트랜잭션 내에서 직접 실행, 없으면 handler 사용 (하위 호환성)
	return connection ? executeSelect(connection) : handler(executeSelect);
};

const selectOne = async <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>,
	options?: { throwError?: boolean },
	selectOptions?: SelectOption<T>,
	connection?: Connection
): Promise<T | undefined> => {
	const executeSelectOne = async (conn: Connection): Promise<T | undefined> => {
		const { sql, values } = buildSelectQuery(query, option, selectOptions, ' LIMIT 1');
		option.printQueryIfNeeded?.(sql);
		const [rows] = await conn.query<RowDataPacket[]>(sql, values);
		if (rows.length === 0) {
			if (options?.throwError) throw new Error('Not found');
			return undefined;
		}
		// selectOne은 단일 행이므로 hasMany 그룹화 없이 중첩 매핑만 적용
		const withRelations = selectOptions?.withRelations;
		if (withRelations && withRelations.length > 0 && option.relations) {
			return mapRowWithRelations(rows[0], option, withRelations, option.relations) as T;
		}
		return option.toObject(rows[0]);
	};

	return connection ? executeSelectOne(connection) : handler(executeSelectOne);
};

export { select, selectOne };
