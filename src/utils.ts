const toObject = <T>(keys: string[], row: Record<string, any>): T => {
	const obj = {} as T;
	Object.entries(keys).forEach(([key, column]) => {
		(obj as any)[key] = row[column];
	});
	return obj;
};
const toRow = <T>(keys: readonly string[], obj: T): Record<string, any> => {
	const row: Record<string, unknown> = {};
	Object.entries(keys).forEach(([key, column]) => {
		row[column] = obj[key as keyof T];
	});
	return row;
};
const toPartialRow = <T>(keys: string[], obj: Partial<T>): Record<string, unknown> => {
	const row: Record<string, unknown> = {};
	Object.entries(obj).forEach(([key, value]) => {
		if (keys.includes(key)) {
			row[key] = value;
		}
	});
	return row;
};
export { toObject, toRow, toPartialRow }
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