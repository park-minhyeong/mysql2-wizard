import { ToRowOption } from "./interface";

const IS_FIELD_REGEX = /^is_/;
const toObject = <T>(keys: string[], row: Record<string, any>): T => {
	const snakeKeys = convertToSnakeStrings([...keys]);
	const result = {} as Record<string, unknown>;
	keys.forEach((key, i) => {
		if(IS_FIELD_REGEX.test(snakeKeys[i])) result[key] = toBoolean(row[snakeKeys[i]]);
		else result[key] = row[snakeKeys[i]];
	});
	return result as T;
};
const toRow = <T>(keys: readonly string[], obj: T, autoSetKeys: readonly string[],option?: ToRowOption): Record<string, any> => {
	const isAutoSet = option?.isAutoSet ?? true;
	const row: Record<string, unknown> = {};
	keys.forEach((key) => {
		if (isAutoSet && autoSetKeys.includes(String(key))) row[[key][0]] = undefined;
		else row[[key][0]] = obj[key as keyof typeof obj];
	});
	const snakeRow = Object.entries(row as Record<string, unknown>).reduce((acc, [key, value]) => {
		acc[convertToSnakeString(key)] = value;
		return acc;
	}, {} as Record<string, unknown>);
	return snakeRow;
};

const toPartialRow = <T>(keys: string[], obj: Partial<T>): Record<string, unknown> => {
	const row: Record<string, unknown> = {};
	Object.entries(obj).forEach(([key, value]) => {
		if (keys.includes(key)) {
			if (IS_FIELD_REGEX.test(key)) row[key] = toDbBoolean(value);
			else row[key] = value;
		}
	});
	return row;
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
export { toObject, toRow, toPartialRow, toBoolean, toDbBoolean }
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