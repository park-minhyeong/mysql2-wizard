import { ColumnType, ToRowOption } from "./interface";

const IS_FIELD_REGEX = /^is_/;
const DATE_FIELD_REGEX = /(at|date|time)$/i; // 날짜 필드 식별용 정규식 (createdAt, updatedAt, startedAt 등)
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2}(\.\d{1,3})?)?$/; // MySQL DATETIME 형식: YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss[.SSS]
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/; // 날짜만 있는 형식: YYYY-MM-DD
const ISO8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/; // ISO 8601 형식: YYYY-MM-DDTHH:mm:ss[.SSS][Z|±HH:mm]

type ColumnTypeMap = Record<string, ColumnType | undefined>;

// JSON 문자열인지 확인하는 함수
const isJsonString = (str: string): boolean => {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed === '') return false;
  
  // 이스케이프된 JSON 문자열 처리 (예: "{\"a\":\"asdf\"}")
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      // 이스케이프된 문자열을 파싱
      const unescaped = JSON.parse(trimmed);
      // 파싱된 결과가 다시 JSON 문자열인지 확인
      if (typeof unescaped === 'string') {
        const innerTrimmed = unescaped.trim();
        if ((innerTrimmed.startsWith('{') && innerTrimmed.endsWith('}')) || 
            (innerTrimmed.startsWith('[') && innerTrimmed.endsWith(']'))) {
          JSON.parse(unescaped);
          return true;
        }
      }
    } catch {
      // 이스케이프된 문자열이 아니거나 내부가 JSON이 아닌 경우
    }
  }
  
  // 일반 JSON 객체나 배열로 시작하는지 확인
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

/** JSON 문자열(이중 이스케이프 포함)을 파싱한다. 실패하면 원본을 돌려준다. */
const parseJsonLoose = (value: string): unknown => {
  try {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      const unescaped: unknown = JSON.parse(trimmed);
      return typeof unescaped === 'string' ? JSON.parse(unescaped) : unescaped;
    }
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Date 객체를 MySQL DATETIME 형식 문자열로 변환 (UTC 기준)
const formatDateForMySQLUTC = (date: Date): string => {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	const seconds = String(date.getUTCSeconds()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 문자열 날짜를 UTC로 변환하여 MySQL DATETIME 형식 문자열로 반환
// 날짜만 있는 경우(YYYY-MM-DD)는 UTC 변환하지 않음 (DATE 타입 필드용)
const convertStringDateToUTC = (dateString: string): string => {
	if (!dateString || typeof dateString !== 'string') return dateString;
	
	const trimmed = dateString.trim();
	
	// 날짜만 있는 경우 (YYYY-MM-DD): UTC 변환하지 않고 그대로 반환
	// DATE 타입 필드는 날짜만 저장하므로 타임존 변환 불필요
	if (DATE_ONLY_REGEX.test(trimmed)) {
		return trimmed;
	}
	
	// ISO 8601 형식 확인: YYYY-MM-DDTHH:mm:ss[.SSS][Z|±HH:mm]
	// 예: 2025-12-30T00:00:00.000Z, 2025-12-30T00:00:00Z, 2025-12-30T00:00:00+09:00
	if (ISO8601_REGEX.test(trimmed)) {
		// Date 객체로 파싱 (자동으로 UTC로 변환됨)
		const date = new Date(trimmed);
		
		// 유효한 날짜인지 확인
		if (!isNaN(date.getTime())) {
			// UTC로 변환하여 MySQL 형식 문자열로 반환
			return formatDateForMySQLUTC(date);
		}
	}
	
	// MySQL DATETIME/TIMESTAMP 형식 확인: YYYY-MM-DD HH:mm:ss[.SSS]
	// 시간 정보가 있는 경우만 UTC로 변환
	if (DATETIME_REGEX.test(trimmed)) {
		// 로컬 타임존으로 파싱
		const localDate = new Date(trimmed);
		
		// 유효한 날짜인지 확인
		if (!isNaN(localDate.getTime())) {
			// UTC로 변환하여 MySQL 형식 문자열로 반환
			return formatDateForMySQLUTC(localDate);
		}
	}
	
	return dateString;
};

// UTC 날짜 문자열을 Date 객체로 변환 (UTC 값 그대로 유지)
const convertUTCStringToDate = (utcString: string): Date | string => {
	if (!utcString || typeof utcString !== 'string') return utcString;
	
	const trimmed = utcString.trim();
	
	// MySQL DATETIME 형식 확인: YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss[.SSS]
	if (DATETIME_REGEX.test(trimmed) || DATE_ONLY_REGEX.test(trimmed)) {
		// UTC로 명시적으로 해석하여 Date 객체 생성
		// DB의 UTC 문자열과 정확하게 같은 값을 가진 Date 객체 생성
		const utcDateString = DATE_ONLY_REGEX.test(trimmed) 
			? trimmed + 'T00:00:00Z'  // 날짜만 있는 경우
			: trimmed.replace(' ', 'T') + 'Z';  // DATETIME 형식인 경우: "2025-12-19 00:30:00" → "2025-12-19T00:30:00Z"
		
		const utcDate = new Date(utcDateString);
		
		// 유효한 날짜인지 확인
		if (!isNaN(utcDate.getTime())) {
			// UTC 시간을 그대로 나타내는 Date 객체 반환
			return utcDate;
		}
	}
	
	return utcString;
};

/** DB 값 → 객체 값 (명시적 columnType) */
const fromDbExplicit = (value: unknown, type: ColumnType): unknown => {
	switch (type) {
		case 'boolean':
			return toBoolean(value);
		case 'date':
			return typeof value === 'string' ? convertUTCStringToDate(value) : value;
		case 'json':
			return typeof value === 'string' ? parseJsonLoose(value) : value;
		case 'raw':
			return value;
	}
};

/** DB 값 → 객체 값 (이름 기반 휴리스틱, 기본 동작) */
const fromDbHeuristic = (key: string, snakeKey: string, value: unknown): unknown => {
	if (IS_FIELD_REGEX.test(snakeKey)) {
		return toBoolean(value);
	}
	if (typeof value !== 'string') {
		return value;
	}
	// 날짜 필드인 경우 UTC 문자열을 Date 객체로 변환
	if (DATE_FIELD_REGEX.test(key) || DATE_FIELD_REGEX.test(snakeKey)) {
		const converted = convertUTCStringToDate(value);
		if (converted instanceof Date) return converted;
		return isJsonString(converted) ? parseJsonLoose(converted) : converted;
	}
	// 모든 문자열 필드에 대해 JSON 파싱 시도
	return isJsonString(value) ? parseJsonLoose(value) : value;
};

const toObject = <T>(keys: string[], row: Record<string, unknown>, columnTypes?: ColumnTypeMap): T => {
	const snakeKeys = convertToSnakeStrings([...keys]);
	const result: Record<string, unknown> = {};
	keys.forEach((key, i) => {
		const snakeKey = snakeKeys[i];
		const value = row[snakeKey];
		const explicit = columnTypes?.[key];
		result[key] = explicit ? fromDbExplicit(value, explicit) : fromDbHeuristic(key, snakeKey, value);
	});
	return result as T;
};

/** 객체 값 → DB 값 (명시적 columnType). undefined는 그대로 둔다(INSERT DEFAULT / UPDATE 제외용). */
const toDbExplicit = (value: unknown, type: ColumnType): unknown => {
	if (value === undefined) return undefined;
	switch (type) {
		case 'boolean':
			return toDbBoolean(value);
		case 'date':
			if (value instanceof Date) return formatDateForMySQLUTC(value);
			return typeof value === 'string' ? convertStringDateToUTC(value) : value;
		case 'json':
			return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
		case 'raw':
			return value;
	}
};

/** 객체 값 → DB 값 (이름 기반 휴리스틱, 기본 동작). is_ 접두사 boolean 변환은 snake 변환 단계에서 처리. */
const toDbHeuristic = (key: string, value: unknown): unknown => {
	// Date 객체 처리: UTC로 변환하여 MySQL DATETIME 형식 문자열로 저장
	if (value instanceof Date) {
		return formatDateForMySQLUTC(value);
	}
	// 문자열 날짜 처리: 로컬 타임존으로 해석 후 UTC로 변환하여 저장
	if (typeof value === 'string') {
		const isDateField = DATE_FIELD_REGEX.test(key) || DATE_FIELD_REGEX.test(convertToSnakeString(key));
		const isDateString = DATETIME_REGEX.test(value.trim()) || DATE_ONLY_REGEX.test(value.trim());
		return isDateField || isDateString ? convertStringDateToUTC(value) : value;
	}
	// JSON 필드 처리: 객체나 배열을 문자열로 변환
	if (value !== null && value !== undefined && typeof value === 'object') {
		return JSON.stringify(value);
	}
	return value;
};

const toRow = <T>(
	keys: readonly string[],
	obj: T,
	autoSetKeys: readonly string[],
	option?: ToRowOption,
	columnTypes?: ColumnTypeMap
): Record<string, unknown> => {
	const isAutoSet = option?.isAutoSet ?? true;
	const row: Record<string, unknown> = {};
	keys.forEach((key) => {
		if (isAutoSet && autoSetKeys.includes(String(key))) {
			row[key] = undefined;
			return;
		}
		const value: unknown = obj[key as keyof T];
		const explicit = columnTypes?.[key];
		row[key] = explicit ? toDbExplicit(value, explicit) : toDbHeuristic(key, value);
	});
	return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
		const snakeKey = convertToSnakeString(key);
		// 명시적 타입이 없는 is_ 접두사 필드만 DB boolean(1/0)으로 변환
		if (!columnTypes?.[key] && IS_FIELD_REGEX.test(snakeKey)) {
			// undefined 값인 is_ 필드는 제외 (UPDATE 시에만 해당)
			if (value === undefined) return acc;
			acc[snakeKey] = toDbBoolean(value);
		} else {
			acc[snakeKey] = value;
		}
		return acc;
	}, {});
};

const toBoolean = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value;
	if (value === 1 || value === '1') return true;
	if (value === 0 || value === '0') return false;
	return Boolean(value);
};
const toDbBoolean = (value: unknown): 1 | 0 => {
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (value === 1 || value === '1') return 1;
	if (value === 0 || value === '0') return 0;
	if (value === undefined || value === null) return 0; // undefined/null을 명시적으로 0으로 처리
	return Boolean(value) ? 1 : 0;
};
export { toObject, toRow, toBoolean, toDbBoolean }
export function removeUndefined<T>(obj: T): T {
	for (const key in obj) {
		if (obj[key] === undefined) {
			delete obj[key];
		}
	}
	return obj;
}

export type ToSnakeCase<S extends string> =
	S extends `${infer First}${infer Rest}`
	? Rest extends Uncapitalize<Rest>
	? `${Lowercase<First>}${ToSnakeCase<Rest>}`
	: `${Lowercase<First>}_${ToSnakeCase<Rest>}`
	: S;
export type ConvertToSnakeCase<T> = {
	[K in keyof T as ToSnakeCase<Extract<K, string>>]: T[K];
};
export const convertToSnakeString = <T extends string>(input: T) =>
	input.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() as ToSnakeCase<T>;
export const convertToSnakeStrings = <T extends string>(strings: ReadonlyArray<T>): string[] =>
	strings.map(convertToSnakeString);
export const toSnakeString = convertToSnakeString;
