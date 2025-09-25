import { CompareQuery, CompareValue, QueryOption } from "../../../interface";
import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from "../../../utils";

const where = <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>
): { conditions: string; values: unknown[] } => {
	const entries = Object.entries(query).filter(([, value]) => value !== undefined);
	const values: unknown[] = [];
	const conditions = entries.map(([key, value]) => {
		const val = value as CompareValue<T[keyof T]>;
		const snakeKey = convertToSnakeString(key); // camelCase → snake_case 변환
		
		// 배열인 경우 - IN 절 처리
		if (Array.isArray(val)) {
			values.push(...val); // 배열 요소들을 펼쳐서 추가
			const placeholders = val.map(() => '?').join(', ');
			return `${mysql2.format('??', [snakeKey])} IN (${placeholders})`;
		}
		
		// {operator, value} 객체인 경우
		if (typeof val === 'object' && val !== null && 'operator' in val && 'value' in val) {
			// operator가 IN이고 value가 배열인 경우
			if (val.operator === 'IN' && Array.isArray(val.value)) {
				values.push(...val.value);
				const placeholders = val.value.map(() => '?').join(', ');
				return `${mysql2.format('??', [snakeKey])} IN (${placeholders})`;
			}
			// 일반 operator인 경우
			values.push(val.value);
			return `${mysql2.format('??', [snakeKey])} ${val.operator} ?`;
		}
		
		// 기본적인 등호 비교
		values.push(val);
		return `${mysql2.format('??', [snakeKey])} = ?`;
	}).join(' AND ');
	return { conditions, values };
};

export default where;