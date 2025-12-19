import { ToRowOption } from "./interface";

const IS_FIELD_REGEX = /^is_/;
const JSON_FIELD_REGEX = /(json|ask|data|config|settings|metadata|options|params|attributes|properties)/i; // JSON 필드 식별용 정규식
const DATE_FIELD_REGEX = /(at|date|time)$/i; // 날짜 필드 식별용 정규식 (createdAt, updatedAt, startedAt 등)
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2}(\.\d{1,3})?)?$/; // MySQL DATETIME 형식: YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss[.SSS]
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/; // 날짜만 있는 형식: YYYY-MM-DD

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

const toObject = <T>(keys: string[], row: Record<string, any>): T => {
	const snakeKeys = convertToSnakeStrings([...keys]);
	const result = {} as Record<string, unknown>;
	keys.forEach((key, i) => {
		const snakeKey = snakeKeys[i];
		const value = row[snakeKey];
		
		if(IS_FIELD_REGEX.test(snakeKey)) {
			result[key] = toBoolean(value);
		} else if (typeof value === 'string' && value !== null && value !== undefined) {
			// 날짜 필드인 경우 UTC 문자열을 Date 객체로 변환
			if (DATE_FIELD_REGEX.test(key) || DATE_FIELD_REGEX.test(snakeKey)) {
				const converted = convertUTCStringToDate(value);
				if (converted instanceof Date) {
					// Date 객체 반환 (UTC 값 그대로 유지)
					result[key] = converted;
				} else if (isJsonString(converted)) {
					// JSON 문자열인 경우 JSON 파싱 시도
					try {
						const trimmed = converted.trim();
						if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
							const unescaped = JSON.parse(trimmed);
							if (typeof unescaped === 'string') {
								result[key] = JSON.parse(unescaped);
							} else {
								result[key] = unescaped;
							}
						} else {
							result[key] = JSON.parse(converted);
						}
					} catch (error) {
						result[key] = converted;
					}
				} else {
					result[key] = converted;
				}
			} else if (isJsonString(value)) {
				// JSON 문자열인 경우 JSON 파싱 시도
				// 모든 문자열 필드에 대해 JSON 파싱 시도
				try {
					const trimmed = value.trim();
					// 이스케이프된 JSON 문자열 처리
					if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
						const unescaped = JSON.parse(trimmed);
						if (typeof unescaped === 'string') {
							result[key] = JSON.parse(unescaped);
						} else {
							result[key] = unescaped;
						}
					} else {
						// 일반 JSON 파싱
						result[key] = JSON.parse(value);
					}
				} catch (error) {
					result[key] = value;
				}
			} else {
				result[key] = value;
			}
		} else {
			result[key] = value;
		}
	});
	return result as T;
};

const toRow = <T>(keys: readonly string[], obj: T, autoSetKeys: readonly string[],option?: ToRowOption): Record<string, any> => {
	const isAutoSet = option?.isAutoSet ?? true;
	const row: Record<string, unknown> = {};
	keys.forEach((key) => {
		if (isAutoSet && autoSetKeys.includes(String(key))) {
			row[[key][0]] = undefined;
		} else {
			const value = obj[key as keyof typeof obj];
			// JSON 필드 처리: 객체나 배열을 문자열로 변환
			if (value !== null && value !== undefined && typeof value === 'object') {
				row[[key][0]] = JSON.stringify(value);
			} else {
				row[[key][0]] = value;
			}
		}
	});
	const snakeRow = Object.entries(row as Record<string, unknown>).reduce((acc, [key, value]) => {
		const snakeKey = convertToSnakeString(key);
		// is_ 접두사가 있는 필드를 DB boolean(1/0)으로 변환
		if (IS_FIELD_REGEX.test(snakeKey)) {
			// undefined 값인 is_ 필드는 제외 (UPDATE 시에만 해당)
			if (value === undefined) {
				return acc; // undefined인 is_ 필드는 결과에 포함하지 않음
			}
			acc[snakeKey] = toDbBoolean(value);
		} else {
			acc[snakeKey] = value;
		}
		return acc;
	}, {} as Record<string, unknown>);
	return snakeRow;
};

const toBoolean = (value: any): boolean => {
	if (typeof value === 'boolean') return value;
	if (value === 1 || value === '1') return true;
	if (value === 0 || value === '0') return false;
	return Boolean(value);
};
const toDbBoolean = (value: any): 1 | 0 => {
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
export const toSnakeString = <T extends string>(input: T) =>
	input.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() as ToSnakeCase<T>;