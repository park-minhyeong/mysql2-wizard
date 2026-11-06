import { QueryOption } from "../../../interface";
import mysql2 from 'mysql2/promise';

/** SET 절. row는 toRow()를 거친 snake_case 행이며 undefined 값은 제외한다. */
const set = <T>(
	row: Record<string, unknown>,
	_option?: QueryOption<T>
): { setConditions: string; setValues: unknown[] } => {
	const entries = Object.entries(row).filter(([, value]) => value !== undefined);
	const setValues: unknown[] = [];
	const setConditions = entries.map(([key, value]) => {
		setValues.push(value);
		return `${mysql2.format('??', [key])} = ?`;
	}).join(', ');
	return { setConditions, setValues };
};

export default set;
