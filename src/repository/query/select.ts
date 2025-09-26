import { RowDataPacket } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, SelectOption, OrderBy, JoinType, JoinClause, Relation, Calculate } from '../../interface/Query';
import { ISelectQueryBuilder, ISelectOneQueryBuilder } from '../../interface/Repository';
import calculate from './calculate';
import where from './condition/where';
import orderBy from './option/orderBy';
import limit from './option/limit';
import buildJoinClause, { buildRelationJoins } from './relation/join';
import buildSelectClause from './select.support';
import { convertToSnakeString, toObject } from '../../utils';

const queryString = <T>({ table }: QueryOption<T>) => ({
	selectAll: mysql2.format('SELECT * FROM ??', [table]),
	select: mysql2.format('SELECT * FROM ?? WHERE ', [table]),
});

// 체이닝 패턴 구현
export class SelectQueryBuilder<T> implements ISelectQueryBuilder<T> {
	private selectOptions: SelectOption<T> = {};
	private joinClauses: JoinClause[] = [];
	private selectColumns: string[] = [];
	private withRelations: string[] = [];  // Enhanced Relations용 (새로 추가)

	constructor(private query: CompareQuery<T> | undefined, private option: QueryOption<T>) { }

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

	// JOIN 메서드 추가 (새로운 기능)
	join(table: string, leftColumn: string, rightColumn: string, type: JoinType = 'INNER'): ISelectQueryBuilder<T> {
		this.joinClauses.push({ table, leftColumn, rightColumn, type });
		this.selectOptions.joins = this.joinClauses;
		return this;
	}

	select(columns: string[]): ISelectQueryBuilder<T> {
		this.selectColumns = columns;
		this.selectOptions.selectColumns = this.selectColumns;
		return this;
	}

	with(relationName: string): ISelectQueryBuilder<T> {
		this.withRelations.push(relationName);
		this.selectOptions.withRelations = this.withRelations;
		return this;
	}

	or(condition: CompareQuery<T> | CompareQuery<T>[] | undefined): ISelectQueryBuilder<T> {
		if (condition !== undefined) {
			if (!this.selectOptions.orConditions) {
				this.selectOptions.orConditions = [];
			}
			if (Array.isArray(condition)) {
				this.selectOptions.orConditions.push(...condition);
			} else {
				this.selectOptions.orConditions.push(condition);
			}
		}
		return this;
	}
	calculate<C extends Record<string, number>>(calculates: Calculate<string & keyof C, T>[]): Promise<C> {
		return calculate<T, C>(this.query, this.option, calculates);
	}
	async execute(): Promise<T[]> {
		return select(this.query, this.option, this.selectOptions);
	}

	// PromiseLike 구현 - 이제 await를 어디서든 사용 가능!
	then<TResult1 = T[], TResult2 = never>(
		onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

// SelectOne용 체이닝 패턴 구현
export class SelectOneQueryBuilder<T> implements ISelectOneQueryBuilder<T> {
	private selectOptions: SelectOption<T> = {};
	private joinClauses: JoinClause[] = [];
	private selectColumns: string[] = [];
	private withRelations: string[] = [];

	constructor(private query: CompareQuery<T>, private option: QueryOption<T>) { }

	orderBy(orderByArray: OrderBy<T>): ISelectOneQueryBuilder<T> {
		this.selectOptions.orderBy = orderByArray;
		return this;
	}

	// JOIN 메서드 추가
	join(table: string, leftColumn: string, rightColumn: string, type: JoinType = 'INNER'): ISelectOneQueryBuilder<T> {
		this.joinClauses.push({ table, leftColumn, rightColumn, type });
		this.selectOptions.joins = this.joinClauses;
		return this;
	}

	// SELECT 컬럼 지정 메서드 추가
	select(columns: string[] | string): ISelectOneQueryBuilder<T> {
		this.selectColumns = Array.isArray(columns) ? columns : [columns];
		this.selectOptions.selectColumns = this.selectColumns;
		return this;
	}

	// Enhanced Relations 메서드 추가
	with(relationName: string): ISelectOneQueryBuilder<T> {
		this.withRelations.push(relationName);
		this.selectOptions.withRelations = this.withRelations;
		return this;
	}
	or(condition: CompareQuery<T> | CompareQuery<T>[] | undefined): ISelectOneQueryBuilder<T> {
		if (condition !== undefined) {
			if (!this.selectOptions.orConditions) {
				this.selectOptions.orConditions = [];
			}
			if (Array.isArray(condition)) {
				this.selectOptions.orConditions.push(...condition);
			} else {
				this.selectOptions.orConditions.push(condition);
			}
		}
		return this;
	}
	async execute(): Promise<T | undefined> {
		return selectOne(this.query, this.option, undefined, this.selectOptions);
	}

	// PromiseLike 구현
	then<TResult1 = T | undefined, TResult2 = never>(
		onfulfilled?: ((value: T | undefined) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

const select = async <T>(
	query: CompareQuery<T> | undefined,
	option: QueryOption<T>,
	selectOptions?: SelectOption<T>
): Promise<T[]> => handler(async connection => {
	let query_: string;
	let values: unknown[] = [];

	// SELECT 절 구성 - keys 기반 향상된 버전
	let selectClause: string;

	if (selectOptions?.selectColumns && selectOptions.selectColumns.length > 0) {
		// 명시적 컬럼 지정
		selectClause = buildSelectClause(selectOptions.selectColumns, option.table);
	} else {
		// keys 기반 자동 구성
		const selectParts: string[] = [];

		// 메인 테이블의 keys 기반 컬럼
		if (option.keys && option.keys.length > 0) {
			const mainColumns = option.keys.map(key =>
				`${mysql2.format('??', [option.table])}.${mysql2.format('??', [key])}`
			);
			selectParts.push(...mainColumns);
		} else {
			selectParts.push(`${mysql2.format('??', [option.table])}.*`);
		}

		// Enhanced Relations의 keys 기반 컬럼
		if (selectOptions?.withRelations && option.relations) {
			for (const relationName of selectOptions.withRelations) {
				const relation = option.relations[relationName];
				if (relation) {
					if (relation.keys && relation.keys.length > 0) {
						// keys가 정의된 경우 - 별칭을 사용해서 컬럼명 충돌 방지
						const relationColumns = relation.keys.map(key => {
							const snakeKey = convertToSnakeString(String(key));
							const aliasName = `${relation.table}__${snakeKey}`;
							return `${mysql2.format('??', [relation.table])}.${mysql2.format('??', [snakeKey])} AS ${mysql2.format('??', [aliasName])}`;
						});
						selectParts.push(...relationColumns);
					} else {
						// keys가 없으면 전체 컬럼
						const allColumns = `${mysql2.format('??', [relation.table])}.*`;
						selectParts.push(allColumns);
					}
				}
			}
		}

		selectClause = selectParts.join(', ');
	}

	// 기본 쿼리 구성 (SELECT ... FROM table)
	query_ = `SELECT ${selectClause} FROM ${mysql2.format('??', [option.table])}`;

	// Enhanced Relations JOIN 처리 (새로운 기능)
	const relationJoins = buildRelationJoins(
		selectOptions?.withRelations,
		option.relations,
		option.table
	);

	// 모든 JOIN 통합 (기존 JOIN + Relations JOIN)
	const allJoins = [
		...(selectOptions?.joins || []),
		...relationJoins
	];

	// JOIN 절 추가 (WHERE 절보다 먼저)
	query_ += buildJoinClause(allJoins);

	// WHERE 절 추가 (JOIN 절 다음에)
	if (query && Object.keys(query).length > 0) {
		const { conditions, values: whereValues } = where(query, option, selectOptions?.orConditions);
		if (conditions.trim()) { // 조건이 실제로 있는 경우에만 WHERE 절 추가
			query_ += ` WHERE ${conditions}`;
			values = whereValues;
		}
	} else if (selectOptions?.orConditions && selectOptions.orConditions.length > 0) {
		// 메인 쿼리가 없지만 OR 조건만 있는 경우
		const { conditions, values: whereValues } = where({} as CompareQuery<T>, option, selectOptions.orConditions);
		if (conditions.trim()) {
			query_ += ` WHERE ${conditions}`;
			values = whereValues;
		}
	}
	query_ += orderBy(selectOptions?.orderBy);
	query_ += limit(selectOptions);
	option.printQueryIfNeeded?.(query_);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);

	// 조인이 사용된 경우 중첩 객체로 구성
	const hasWithRelations = selectOptions?.withRelations && selectOptions.withRelations.length > 0;
	const hasJoins = (selectOptions?.joins && selectOptions.joins.length > 0) || hasWithRelations;

	// Enhanced Relations가 사용된 경우에만 중첩 구조 적용
	if (hasWithRelations && option.relations) {
		// hasMany 관계가 있는 경우 그룹화 처리 필요
		const hasHasManyRelations = selectOptions.withRelations!.some(relationName => {
			const relation = option.relations![relationName];
			return relation && relation.type === 'hasMany';
		});

		if (hasHasManyRelations) {
			// 메인 레코드별로 그룹화
			const groupedByMain = new Map<string, any>();

			for (const row of rows) {
				const mainData = option.toObject(row);
				const mainKey = JSON.stringify(mainData); // 메인 데이터로 키 생성

				if (!groupedByMain.has(mainKey)) {
					const result = { ...mainData } as any;

					// 각 관계별로 초기화
					for (const relationName of selectOptions.withRelations!) {
						const relation = option.relations![relationName];
						if (relation) {
							if (relation.type === 'hasMany') {
								result[relationName] = [];
							} else {
								result[relationName] = null;
							}
						}
					}

					groupedByMain.set(mainKey, result);
				}

				const mainRecord = groupedByMain.get(mainKey)!;

				// 각 관계별로 데이터 추가
				for (const relationName of selectOptions.withRelations!) {
					const relation: Relation = option.relations![relationName];
					if (relation && relation.keys) {
						const relationData: any = {};
						let hasRelationData = false;

						// 관계 테이블의 컬럼들을 확인해서 데이터가 있는지 검사 (별칭 사용)
						for (const key of relation.keys) {
							const snakeKey = convertToSnakeString(String(key));
							const aliasKey = `${relation.table}__${snakeKey}`;
							if (row[aliasKey] !== undefined && row[aliasKey] !== null) {
								hasRelationData = true;
								break; // 하나라도 데이터가 있으면 충분
							}
						}

						if (hasRelationData) {
							// 별칭된 데이터를 원래 키로 매핑해서 toObject에 전달
							const relationRowData: Record<string, any> = {};
							for (const key of relation.keys) {
								const snakeKey = convertToSnakeString(String(key));
								const aliasKey = `${relation.table}__${snakeKey}`;
								relationRowData[snakeKey] = row[aliasKey];
							}
							// toObject 함수를 사용해서 relation 데이터 구성
							const relationDataConverted = toObject(relation.keys as string[], relationRowData);
							if (relation.type === 'hasMany') {
								// hasMany인 경우 배열에 추가 (중복 체크)
								const existing = mainRecord[relationName].find((item: any) =>
									JSON.stringify(item) === JSON.stringify(relationDataConverted)
								);
								if (!existing) {
									mainRecord[relationName].push(relationDataConverted);
								}
							} else {
								// hasOne인 경우 단일 객체
								mainRecord[relationName] = relationDataConverted;
							}
						}
					}
				}
			}

			return Array.from(groupedByMain.values());
		} else {
			// hasMany 관계가 없는 경우 기존 로직 사용
			return rows.map(row => {
				// 메인 테이블 데이터
				const mainData = option.toObject(row);

				// 각 관계별로 중첩 객체 구성
				const result = { ...mainData } as any;

				for (const relationName of selectOptions.withRelations!) {
					const relation: Relation = option.relations![relationName];
					if (relation && relation.keys) {
						// 관계 테이블의 컬럼들을 확인해서 데이터가 있는지 검사 (별칭 사용)
						let hasRelationData = false;
						for (const key of relation.keys) {
							const snakeKey = convertToSnakeString(String(key));
							const aliasKey = `${relation.table}__${snakeKey}`;
							if (row[aliasKey] !== undefined && row[aliasKey] !== null) {
								hasRelationData = true;
								break; // 하나라도 데이터가 있으면 충분
							}
						}

						// 관계 데이터가 있는 경우에만 추가
						if (hasRelationData) {
							// 별칭된 데이터를 원래 키로 매핑해서 toObject에 전달
							const relationRowData: Record<string, any> = {};
							for (const key of relation.keys) {
								const snakeKey = convertToSnakeString(String(key));
								const aliasKey = `${relation.table}__${snakeKey}`;
								relationRowData[snakeKey] = row[aliasKey];
							}
							// toObject 함수를 사용해서 relation 데이터 구성
							const relationDataConverted = toObject(relation.keys as string[], relationRowData);
							result[relationName] = relationDataConverted;
						} else {
							result[relationName] = null;
						}
					}
				}
				return result;
			});
		}
	}

	// 기존 동작: 단순 JOIN이나 관계 없는 경우
	return rows.map(row => option.toObject(row));
});
const selectOne = async <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>,
	options?: { throwError?: boolean },
	selectOptions?: SelectOption<T>
): Promise<T | undefined> => handler(async connection => {
	// SELECT 절 구성 - select 함수와 동일한 로직 적용
	let selectClause: string;

	if (selectOptions?.selectColumns && selectOptions.selectColumns.length > 0) {
		// 명시적 컬럼 지정
		selectClause = buildSelectClause(selectOptions.selectColumns, option.table);
	} else {
		// keys 기반 자동 구성
		const selectParts: string[] = [];

		// 메인 테이블의 keys 기반 컬럼
		if (option.keys && option.keys.length > 0) {
			const mainColumns = option.keys.map(key =>
				`${mysql2.format('??', [option.table])}.${mysql2.format('??', [key])}`
			);
			selectParts.push(...mainColumns);
		} else {
			selectParts.push(`${mysql2.format('??', [option.table])}.*`);
		}

		// Enhanced Relations의 keys 기반 컬럼
		if (selectOptions?.withRelations && option.relations) {
			for (const relationName of selectOptions.withRelations) {
				const relation = option.relations[relationName];
				if (relation) {
					if (relation.keys && relation.keys.length > 0) {
						// keys가 정의된 경우 - 별칭을 사용해서 컬럼명 충돌 방지
						const relationColumns = relation.keys.map(key => {
							const snakeKey = convertToSnakeString(String(key));
							const aliasName = `${relation.table}__${snakeKey}`;
							return `${mysql2.format('??', [relation.table])}.${mysql2.format('??', [snakeKey])} AS ${mysql2.format('??', [aliasName])}`;
						});
						selectParts.push(...relationColumns);
					} else {
						// keys가 없으면 전체 컬럼
						selectParts.push(`${mysql2.format('??', [relation.table])}.*`);
					}
				}
			}
		}

		selectClause = selectParts.join(', ');
	}

	// 기본 쿼리 구성 (SELECT ... FROM table)
	let query_ = `SELECT ${selectClause} FROM ${mysql2.format('??', [option.table])}`;

	// Enhanced Relations JOIN 처리
	const relationJoins = buildRelationJoins(
		selectOptions?.withRelations,
		option.relations,
		option.table
	);

	// 모든 JOIN 통합
	const allJoins = [
		...(selectOptions?.joins || []),
		...relationJoins
	];

	// JOIN 절 추가 (WHERE 절보다 먼저)
	query_ += buildJoinClause(allJoins);

	// WHERE 절 추가 (JOIN 절 다음에)
	const { conditions, values } = where(query, option, selectOptions?.orConditions);
	if (conditions.trim()) { // 조건이 실제로 있는 경우에만 WHERE 절 추가
		query_ += ` WHERE ${conditions}`;
	}

	// ORDER BY 절 추가
	query_ += orderBy(selectOptions?.orderBy);

	// LIMIT 1 자동 추가 (findOne이므로)
	query_ += ` LIMIT 1`;

	option.printQueryIfNeeded?.(query_);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);
	if (rows.length === 0) {
		if (options?.throwError) throw new Error('Not found');
		return undefined;
	}

	// Enhanced Relations가 사용된 경우 중첩 구조 적용
	const hasWithRelations = selectOptions?.withRelations && selectOptions.withRelations.length > 0;
	if (hasWithRelations && option.relations) {
		const row = rows[0];
		// 메인 테이블 데이터
		const mainData = option.toObject(row);

		// 각 관계별로 중첩 객체 구성
		const result = { ...mainData } as any;

		for (const relationName of selectOptions.withRelations!) {
			const relation: Relation = option.relations![relationName];
			if (relation && relation.keys) {
				// 관계 테이블의 컬럼들을 확인해서 데이터가 있는지 검사 (별칭 사용)
				let hasRelationData = false;
				for (const key of relation.keys) {
					const snakeKey = convertToSnakeString(String(key));
					const aliasKey = `${relation.table}__${snakeKey}`;
					if (row[aliasKey] !== undefined && row[aliasKey] !== null) {
						hasRelationData = true;
						break; // 하나라도 데이터가 있으면 충분
					}
				}

				// 관계 데이터가 있는 경우에만 추가
				if (hasRelationData) {
					// 별칭된 데이터를 원래 키로 매핑해서 toObject에 전달
					const relationRowData: Record<string, any> = {};
					for (const key of relation.keys) {
						const snakeKey = convertToSnakeString(String(key));
						const aliasKey = `${relation.table}__${snakeKey}`;
						relationRowData[snakeKey] = row[aliasKey];
					}
					// toObject 함수를 사용해서 relation 데이터 구성
					const relationDataConverted = toObject(relation.keys as string[], relationRowData);
					result[relationName] = relationDataConverted;
				} else {
					result[relationName] = null;
				}
			}
		}

		return result;
	}

	return option.toObject(rows[0]);
});

export { select, selectOne };
