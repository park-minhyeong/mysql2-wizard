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

// MySQL DATETIME 문자열(UTC)을 Date 객체로 변환 (UTC로 해석 후 로컬 타임존으로 변환)
const parseDateString = (dateString: string): Date | string => {
	if (!dateString || typeof dateString !== 'string') return dateString;
	
	const trimmed = dateString.trim();
	
	// MySQL DATETIME 형식 확인: YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss[.SSS]
	if (DATETIME_REGEX.test(trimmed) || DATE_ONLY_REGEX.test(trimmed)) {
		// DB에 UTC로 저장되어 있으므로, UTC로 해석하고 로컬 타임존 Date 객체로 변환
		// "2025-12-19 00:30:00" (UTC) → 로컬 타임존 Date 객체 (한국시간이면 +09:00)
		const date = new Date(trimmed + 'Z'); // 'Z'를 추가하여 UTC로 명시적으로 해석
		// 유효한 날짜인지 확인
		if (!isNaN(date.getTime())) {
			return date;
		}
	}
	
	return dateString;
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
			// 날짜 필드인 경우 Date 객체로 변환 (타임존 변환 포함)
			if (DATE_FIELD_REGEX.test(key) || DATE_FIELD_REGEX.test(snakeKey)) {
				const parsed = parseDateString(value);
				if (parsed instanceof Date) {
					result[key] = parsed;
				} else if (isJsonString(value)) {
					// JSON 문자열인 경우 JSON 파싱 시도
					try {
						const trimmed = value.trim();
						if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
							const unescaped = JSON.parse(trimmed);
							if (typeof unescaped === 'string') {
								result[key] = JSON.parse(unescaped);
							} else {
								result[key] = unescaped;
							}
						} else {
							result[key] = JSON.parse(value);
						}
					} catch (error) {
						result[key] = value;
					}
				} else {
					result[key] = parsed;
				}
			} else if (isJsonString(value)) {
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
				// 일반 문자열이지만 날짜 형식일 수 있음 (필드 이름으로 감지되지 않은 경우)
				const parsed = parseDateString(value);
				result[key] = parsed instanceof Date ? parsed : value;
			}
		} else {
			result[key] = value;
		}
	});
	return result as T;
};
// Date 객체를 MySQL DATETIME 형식 문자열로 변환 (로컬 타임존 기준)
const formatDateForMySQL = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
const convertStringDateToUTC = (dateString: string): string => {
	if (!dateString || typeof dateString !== 'string') return dateString;
	
	const trimmed = dateString.trim();
	
	// 날짜만 있는 경우 (YYYY-MM-DD): 시간을 00:00:00으로 추가
	if (DATE_ONLY_REGEX.test(trimmed)) {
		const localDate = new Date(trimmed + ' 00:00:00');
		if (!isNaN(localDate.getTime())) {
			return formatDateForMySQLUTC(localDate);
		}
	}
	// MySQL DATETIME 형식 확인: YYYY-MM-DD HH:mm:ss[.SSS]
	else if (DATETIME_REGEX.test(trimmed)) {
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

const toRow = <T>(keys: readonly string[], obj: T, autoSetKeys: readonly string[],option?: ToRowOption): Record<string, any> => {
	const isAutoSet = option?.isAutoSet ?? true;
	const row: Record<string, unknown> = {};
	keys.forEach((key) => {
		if (isAutoSet && autoSetKeys.includes(String(key))) {
			row[[key][0]] = undefined;
		} else {
			const value = obj[key as keyof typeof obj];
			// Date 객체 처리: MySQL DATETIME 형식 문자열로 변환 (로컬 타임존 기준)
			if (value instanceof Date) {
				row[[key][0]] = formatDateForMySQL(value);
			}
			// 문자열 날짜 처리: 로컬 타임존으로 해석 후 UTC로 변환하여 저장
			else if (typeof value === 'string' && value !== null && value !== undefined) {
				// 날짜 필드인 경우 UTC로 변환
				if (DATE_FIELD_REGEX.test(key) || DATE_FIELD_REGEX.test(convertToSnakeString(String(key)))) {
					row[[key][0]] = convertStringDateToUTC(value);
				} else {
					row[[key][0]] = value;
				}
			}
			// JSON 필드 처리: 객체나 배열을 문자열로 변환 (Date 제외)
			else if (value !== null && value !== undefined && typeof value === 'object') {
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