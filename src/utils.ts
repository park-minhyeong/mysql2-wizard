import { ToRowOption } from "./interface";

const IS_FIELD_REGEX = /^is_/;
const JSON_FIELD_REGEX = /(json|ask|data|config|settings|metadata|options|params|attributes|properties)/i; // JSON 필드 식별용 정규식

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

const toObject = <T>(keys: string[], row: Record<string, any>): T => {
	const snakeKeys = convertToSnakeStrings([...keys]);
	const result = {} as Record<string, unknown>;
	keys.forEach((key, i) => {
		const snakeKey = snakeKeys[i];
		const value = row[snakeKey];
		
		if(IS_FIELD_REGEX.test(snakeKey)) {
			result[key] = toBoolean(value);
		} else if (typeof value === 'string' && value !== null && isJsonString(value)) {
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