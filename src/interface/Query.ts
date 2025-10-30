import { RowDataPacket } from "mysql2/promise";

// 컬럼 매핑을 위한 타입
export type ColumnMapping<T> = {
	[k in keyof T]: string;
};

export type AutoSetColumns<T> = keyof T;

// 비교 연산자 타입
export type CompareOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';

// LIKE 패턴 타입
export type LikePattern = 'starts' | 'ends' | 'contains' | 'exact';

// ORDER BY 관련 타입
export type OrderDirection = 'ASC' | 'DESC';
export interface OrderByClause<T> {
	column: keyof T;
	direction: OrderDirection;
}
export type OrderBy<T> = OrderByClause<T>[];

export type CalculateFn = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';

export type CalculateRaw<A extends string, T> = {
	fn: CalculateFn;
	alias: A;
	column?: keyof T;
};

export interface CalculateCount<A extends string, T> extends CalculateRaw<A, T> {
	fn: 'COUNT';
	column?: keyof T;
	case?: { when?: CompareQuery<T>; };
}
export interface CalculateSum<A extends string, T> extends CalculateRaw<A, T> {
	fn: 'SUM';
	column: keyof T;
	case?: { when?: CompareQuery<T>; then?: number; else?: number };
}
export interface CalculateAvg<A extends string, T> extends CalculateRaw<A, T> {
	fn: 'AVG';
	column: keyof T;
	case?: { when: CompareQuery<T>; then?: number; else?: number } | undefined;
}
export interface CalculateMin<A extends string, T> extends CalculateRaw<A, T> {
	fn: 'MIN';
	column: keyof T;
	case?: { when: CompareQuery<T>; then?: number; else?: number } | undefined;
}
export interface CalculateMax<A extends string, T> extends CalculateRaw<A, T> {
	fn: 'MAX';
	column: keyof T;
	case?: { when: CompareQuery<T>; then?: number; else?: number } | undefined;
}

export type Calculate<A extends string, T> = CalculateSum<A, T> | CalculateAvg<A, T> | CalculateMin<A, T> | CalculateMax<A, T> | CalculateCount<A, T>;


export type InferCalculateResult<T extends Calculate<string, T>[]> = {
	[K in T[number]['alias']]: number;
};


// JOIN 관련 타입 (새로 추가)
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
export interface JoinClause {
	table: string;
	leftColumn: string;
	rightColumn: string;
	type: JoinType;
}

// Enhanced Relations 타입 (새로 추가)
export type RelationType = 'hasOne' | 'hasMany' | 'belongsTo';
export interface Relation {
	table: string;
	localKey: string;
	foreignKey: string;
	type: RelationType;
	joinType?: JoinType;  // 기본값: INNER
	keys?: readonly string[];  // 조인된 테이블에서 선택할 컬럼들 (새로 추가)
}

export type Relations = Record<string, Relation>;

// 쿼리 옵션 타입 (SELECT용으로 이름 변경)
export interface SelectOption<T> {
	orderBy?: OrderBy<T>;
	limit?: number;
	offset?: number;
	joins?: JoinClause[];        // 새로 추가
	selectColumns?: string[];    // 새로 추가
	withRelations?: string[];    // Enhanced Relations용 (새로 추가)
	orConditions?: CompareQuery<T>[];  // OR 조건들 (새로 추가)
	calculates?: [Calculate<string, T>, CompareQuery<T>][];  // calculate 메서드용 (새로 추가)
}

// 비교 값 타입
// LIKE 전용: JSON 경로 검색을 위해 객체 형태를 허용
type JsonLikePrimitive = string | number | boolean | null | undefined;
type JsonLikeObject = Record<string, JsonLikePrimitive>;

export type CompareValue<T> = 
    | T 
    | T[] 
    | { operator: Exclude<CompareOperator, 'IN' | 'LIKE'>; value: T }
    | { operator: 'LIKE'; value: T | JsonLikePrimitive | JsonLikeObject | undefined; pattern?: LikePattern }
    | { operator: 'IN'; value: T[] };

// 비교 쿼리 타입
type CompareQuery<T> = {
	[K in keyof T]?: CompareValue<T[K]>;
};

interface QueryConfig {
	table: string;
	autoSetColumns?: readonly string[];
	printQuery?: boolean;
	printQueryIfNeeded?: (query: string) => void;
}

export interface ToRowOption{
	isAutoSet?:boolean
}
// 쿼리 옵션 인터페이스
interface QueryOption<T> {
	table: string;
	keys: readonly string[];
	autoSetColumns?: string[];
	printQuery?: boolean;
	printQueryIfNeeded?: (query: string) => void;
	toRow: (obj: T, option?: ToRowOption) => Record<string, unknown>;
	toObject: (row: Record<string, unknown>) => T;
	relations?: Relations;  // Enhanced Relations 지원 (새로 추가)
}

// 쿼리 문자열 생성을 위한 인터페이스
interface QueryString {
	table: string;
	columns: Record<string, string>;
}

export type { QueryString, QueryOption, QueryConfig, CompareQuery };