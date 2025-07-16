import { QueryOption } from "../../../interface";
import mysql2 from 'mysql2/promise';

const set = <T>(
	obj: Partial<T>,
	option: QueryOption<T>
): { setConditions: string; setValues: unknown[] } => {
	const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
	const setValues: unknown[] = [];
	const setConditions = entries.map(([key, value]) => {
		setValues.push(value);
		return `${mysql2.format('??', [key])} = ?`;
	}).join(', ');
	return { setConditions, setValues };
};

export default set;