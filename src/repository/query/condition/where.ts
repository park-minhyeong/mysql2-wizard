import { CompareQuery, CompareValue, QueryOption } from "../../../interface";
import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from "../../../utils";

// 조건 처리 헬퍼 함수 (중복 제거)
const processCondition = <T>(
	key: string,
	value: CompareValue<T[keyof T]>,
	values: unknown[]
): string | null => {
	const snakeKey = convertToSnakeString(key);
	
	// 배열인 경우 - IN 절 처리
	if (Array.isArray(value)) {
		values.push(...value);
		const placeholders = value.map(() => '?').join(', ');
		return `${mysql2.format('??', [snakeKey])} IN (${placeholders})`;
	}
	
	// {operator, value} 객체인 경우
	if (typeof value === 'object' && value !== null && 'operator' in value && 'value' in value) {
		// value가 undefined, null인 경우 조건 제외
		if (value.value === undefined || value.value === null) {
			return null; // 조건을 제외하기 위해 null 반환
		}
		
		// operator가 IN이고 value가 배열인 경우
		if (value.operator === 'IN' && Array.isArray(value.value)) {
			values.push(...value.value);
			const placeholders = value.value.map(() => '?').join(', ');
			return `${mysql2.format('??', [snakeKey])} IN (${placeholders})`;
		}
		// LIKE 연산자인 경우 패턴 처리
		if (value.operator === 'LIKE') {
			// value가 빈 문자열인 경우 조건 제외
			if (value.value === '') {
				return null; // 조건을 제외하기 위해 null 반환
			}
			
			let likeValue: string = String(value.value);
			const pattern = value.pattern || 'contains'; // 기본값: contains (%_%)
			switch (pattern) {
				case 'starts':
					likeValue = `${likeValue}%`; // _%
					break;
				case 'ends':
					likeValue = `%${likeValue}`; // %_
					break;
				case 'contains':
					likeValue = `%${likeValue}%`; // %_%
					break;
				case 'exact':
					// exact는 % 없이 그대로 사용
					break;
			}
			values.push(likeValue);
			return `${mysql2.format('??', [snakeKey])} LIKE ?`;
		}
		// 일반 operator인 경우
		values.push(value.value);
		return `${mysql2.format('??', [snakeKey])} ${value.operator} ?`;
	}
	
	// 기본적인 등호 비교
	// value가 undefined, null인 경우 조건 제외
	if (value === undefined || value === null) {
		return null; // 조건을 제외하기 위해 null 반환
	}
	
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
	}).filter(condition => condition !== null).join(' AND ');
	// OR 조건 처리 (내부 AND)
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
				}).filter(condition => condition !== null).join(' AND ');
				
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
	
	// 메인 조건과 OR 조건들 결합
	let finalConditions = conditions;
	const allOrConditions = [orConditionsString].filter(Boolean);
	
	if (allOrConditions.length > 0) {
		const combinedOrConditions = allOrConditions.join(' OR ');
		if (finalConditions.trim()) {
			// 메인 조건이 있으면: (메인조건들) AND (OR조건들)
			finalConditions = `(${finalConditions}) AND (${combinedOrConditions})`;
		} else {
			// 메인 조건이 없으면: OR조건들만
			finalConditions = combinedOrConditions;
		}
	}

	return { conditions: finalConditions, values };
};

export default where;