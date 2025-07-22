import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from '../../../utils';
import { Relations, JoinClause, JoinType } from '../../../interface/Query';

const buildRelationJoins = (
	withRelations?: string[], 
	relations?: Relations, 
	mainTable?: string
): JoinClause[] => {
	if (!withRelations || !relations || withRelations.length === 0) {
		return [];
	}

	return withRelations.map(relationName => {
		const relation = relations[relationName];
		if (!relation) {
			throw new Error(`Relation '${relationName}' not found in repository configuration`);
		}

		// 관계 타입에 따른 기본 JOIN 타입 결정
		const defaultJoinType: JoinType = relation.type === 'hasMany' ? 'LEFT' : 'INNER';
		const joinType = relation.joinType || defaultJoinType;

		// 컬럼명 구성 (snake_case 변환 적용)
		const localColumn = mainTable 
			? `${mainTable}.${convertToSnakeString(relation.localKey)}`
			: convertToSnakeString(relation.localKey);
		
		const foreignColumn = `${relation.table}.${convertToSnakeString(relation.foreignKey)}`;

		return {
			table: relation.table,
			leftColumn: localColumn,
			rightColumn: foreignColumn,
			type: joinType
		};
	});
};

export default buildRelationJoins; 