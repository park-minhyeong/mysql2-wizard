import { CompareQuery, CompareValue, QueryOption } from "../../../interface";
import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from "../../../utils";

// 조건 처리 헬퍼 함수 (중복 제거)
const processCondition = <T>(
	key: string,
	value: CompareValue<T[keyof T]>,
	values: unknown[]
): string => {
	const snakeKey = convertToSnakeString(key);
	
	// 배열인 경우 - IN 절 처리
	if (Array.isArray(value)) {
		values.push(...value);
		const placeholders = value.map(() => '?').join(', ');
		return `${mysql2.format('??', [snakeKey])} IN (${placeholders})`;
	}
	
	// {operator, value} 객체인 경우
	if (typeof value === 'object' && value !== null && 'operator' in value && 'value' in value) {
		// operator가 IN이고 value가 배열인 경우
		if (value.operator === 'IN' && Array.isArray(value.value)) {
			values.push(...value.value);
			const placeholders = value.value.map(() => '?').join(', ');
			return `${mysql2.format('??', [snakeKey])} IN (${placeholders})`;
		}
		// 일반 operator인 경우
		values.push(value.value);
		return `${mysql2.format('??', [snakeKey])} ${value.operator} ?`;
	}
	
	// 기본적인 등호 비교
	values.push(value);
	return `${mysql2.format('??', [snakeKey])} = ?`;
};

const where = <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>,
	orConditions?: CompareQuery<T>[]
): { conditions: string; values: unknown[] } => {
	const entries = Object.entries(query).filter(([, value]) => value !== undefined);
	const values: unknown[] = [];
	const conditions = entries.map(([key, value]) => {
		const val = value as CompareValue<T[keyof T]>;
		return processCondition(key, val, values);
	}).join(' AND ');

	// OR 조건 처리
	let orConditionsString = '';
	if (orConditions && orConditions.length > 0) {
		const orParts: string[] = [];
		
		for (const orQuery of orConditions) {
			const orEntries = Object.entries(orQuery).filter(([, value]) => value !== undefined);
			if (orEntries.length > 0) {
				const orValues: unknown[] = [];
				const orConditionsPart = orEntries.map(([key, value]) => {
					const val = value as CompareValue<T[keyof T]>;
					return processCondition(key, val, orValues);
				}).join(' AND ');
				
				if (orConditionsPart.trim()) {
					orParts.push(`(${orConditionsPart})`);
					values.push(...orValues);
				}
			}
		}
		
		if (orParts.length > 0) {
			orConditionsString = orParts.join(' OR ');
		}
	}

	// 메인 조건과 OR 조건 결합
	let finalConditions = conditions;
	if (orConditionsString) {
		if (finalConditions.trim()) {
			finalConditions = `(${finalConditions}) AND (${orConditionsString})`;
		} else {
			finalConditions = orConditionsString;
		}
	}

	return { conditions: finalConditions, values };
};

export default where;