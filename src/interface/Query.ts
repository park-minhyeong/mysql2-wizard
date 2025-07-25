import { RowDataPacket } from "mysql2/promise";

// 컬럼 매핑을 위한 타입
export type ColumnMapping<T> = {
	[k in keyof T]: string;
};

export type AutoSetColumns<T> = keyof T;

// 비교 연산자 타입
export type CompareOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';

// ORDER BY 관련 타입
export type OrderDirection = 'ASC' | 'DESC';
export interface OrderByClause<T> {
	column: keyof T;
	direction: OrderDirection;
}
export type OrderBy<T> = OrderByClause<T>[];

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
}

// 비교 값 타입
export type CompareValue<T> = 
	| T 
	| T[] 
	| { operator: Exclude<CompareOperator, 'IN'>; value: T }
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