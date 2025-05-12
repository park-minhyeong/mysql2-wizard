import { RowDataPacket } from "mysql2/promise";

// 컬럼 매핑을 위한 타입
export type ColumnMapping<T> = {
	[k in keyof T]: string;
};

export type AutoSetColumns<T> = keyof T;

// 비교 연산자 타입
export type CompareOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';

// 비교 값 타입
export type CompareValue<T> = T | { operator: CompareOperator; value: T };

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

// 쿼리 옵션 인터페이스
interface QueryOption<T> {
	table: string;
	keys: readonly string[];
	autoSetColumns?: string[];
	printQuery?: boolean;
	printQueryIfNeeded?: (query: string) => void;
	toRow: (obj: T) => Record<string, unknown>;
	toObject: (row: Record<string, unknown>) => T;
}

// 쿼리 문자열 생성을 위한 인터페이스
interface QueryString {
	table: string;
	columns: Record<string, string>;
}

export type { QueryString, QueryOption, QueryConfig, CompareQuery };