import { type RowDataPacket } from "mysql2";
export function transfers<
	O extends Record<string, any>, // Object type
	K extends Extract<keyof O, string> = Extract<keyof O, string>, // Key string type
>(keys: ReadonlyArray<K>, columns: ReadonlyArray<string>): {
	toObject: (row: RowDataPacket) => O;
	toRow: (obj: O) => RowDataPacket;
} {
	if (keys.length !== columns.length) throw new Error('keys and columns length must be same');
	const toObject = (row: RowDataPacket) => {
		const obj = {} as O;
		for (let i = 0; i < columns.length; i++) {
			const key = keys[i];
			const column = columns[i];
			const value = row[column];
			obj[key] = value as unknown as O[K]; 
		}
		return obj;
	};
	const toRow = (obj: O): RowDataPacket => {
		const row = {} as RowDataPacket;
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			const value = obj[key];
			const column = columns[i];
			row[column] = value;
		}
		return row;
	};
	return { toObject, toRow };
}