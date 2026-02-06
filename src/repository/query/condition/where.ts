import { CompareQuery, CompareValue, QueryOption } from "../../../interface";
import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from "../../../utils";
import { dbType } from "../../../config";

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
		// null 값은 연산자에 따라 IS NULL/IS NOT NULL 처리 (mysql/mariadb 동일)
		if (value.value === null) {
			const op = String(value.operator).toUpperCase();
			if (op === '=' || op === '==') {
				return `${mysql2.format('??', [snakeKey])} IS NULL`;
			}
			if (op === '!=' || op === '<>') {
				return `${mysql2.format('??', [snakeKey])} IS NOT NULL`;
			}
			// 기타 비교 연산자(>, <, >=, <= 등)와 null은 의미 없으므로 제외
			return null;
		}
		// operator가 IN이고 value가 배열인 경우
		if (value.operator === 'IN' && Array.isArray(value.value)) {
			values.push(...value.value);
			const placeholders = value.value.map(() => '?').join(', ');
			return `${mysql2.format('??', [snakeKey])} IN (${placeholders})`;
		}
		// operator가 IN_JSON이고 value가 배열인 경우
		if (value.operator === 'IN_JSON' && Array.isArray(value.value)) {
			if (value.value.length === 0) return null; // 빈 배열이면 조건 제외
			
			// 모든 요소가 배열이면 각 하위 배열에 대해 JSON_CONTAINS로 OR 조건 구성 (합집합)
			const isEveryArray = value.value.every(v => Array.isArray(v));
			if (isEveryArray) {
				const parts: string[] = [];
				for (const sub of value.value as any[]) {
					if (!Array.isArray(sub) || sub.length === 0) continue;
					const ph = sub.map(() => '?').join(', ');
					parts.push(`JSON_CONTAINS(${mysql2.format('??', [snakeKey])}, JSON_ARRAY(${ph}))`);
					values.push(...sub);
				}
				if (parts.length === 0) return null;
				return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0];
			}
			
			// 일부 또는 전부가 배열이 아닌 경우: 단일 JSON_ARRAY로 JSON_OVERLAPS
			const hasNestedArray = (value.value as any[]).some(v => Array.isArray(v));
			const flatValues = hasNestedArray ? (value.value as any[]).flat() : (value.value as any[]);
			const placeholders = flatValues.map(() => '?').join(', ');
			values.push(...flatValues);
			return `JSON_OVERLAPS(${mysql2.format('??', [snakeKey])}, JSON_ARRAY(${placeholders}))`;
		}
		// LIKE 연산자인 경우 패턴 처리
		if (value.operator === 'LIKE') {
			// value가 undefined인 경우 조건 제외
			if (value.value === undefined) {
				return null; // 조건을 제외하기 위해 null 반환
			}
			// value가 빈 문자열인 경우 조건 제외
			if (value.value === '') {
				return null; // 조건을 제외하기 위해 null 반환
			}
			
			// JSON 컬럼 지원: value가 객체면 각 키를 JSON 경로로 LIKE 처리 (OR 묶음)
			if (typeof value.value === 'object' && value.value !== null) {
				const jsonEntries = Object.entries(value.value as Record<string, unknown>).filter(([, v]) => v !== undefined);
				if (jsonEntries.length === 0) {
					return null;
				}
				const pattern = value.pattern || 'contains';
				const parts: string[] = [];
				for (const [jsonKey, raw] of jsonEntries) {
					let likeValue: string = String(raw as unknown as string);
					switch (pattern) {
						case 'starts':
							likeValue = `${likeValue}%`;
							break;
						case 'ends':
							likeValue = `%${likeValue}`;
							break;
						case 'contains':
							likeValue = `%${likeValue}%`;
							break;
						case 'exact':
							break;
					}
					const jsonPath = `$.${jsonKey}`;
					const jsonExpr = `JSON_UNQUOTE(JSON_EXTRACT(${mysql2.format('??', [snakeKey])}, ?))`;
					parts.push(`CAST(${jsonExpr} AS CHAR) LIKE ?`);
					values.push(jsonPath, likeValue);
				}
				return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0];
			}
			
			// 일반 문자열 LIKE
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
	if (value === null) {
		return `${mysql2.format('??', [snakeKey])} IS NULL`;
	}
	values.push(value);
	return `${mysql2.format('??', [snakeKey])} = ?`;
};

const where = <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>,
	orConditions?: CompareQuery<T>[]
): { conditions: string; values: unknown[] } => {
	const entries = Object.entries(query).filter(([, value]) => {
		// undefined 값만 제외 (null은 포함)
		if (value === undefined) return false;
		
		// 객체인 경우 value 속성이 undefined인지 확인
		if (typeof value === 'object' && value !== null && 'value' in value) {
			return value.value !== undefined;
		}
		
		return true;
	});
	
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
			const orEntries = Object.entries(orQuery).filter(([, value]) => {
				// undefined 값만 제외 (null은 포함)
				if (value === undefined) return false;
				
				// 객체인 경우 value 속성이 undefined인지 확인
				if (typeof value === 'object' && value !== null && 'value' in value) {
					return value.value !== undefined;
				}
				
				return true;
			});
			
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