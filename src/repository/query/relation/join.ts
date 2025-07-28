import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from '../../../utils';
import { JoinClause, Relations, JoinType } from '../../../interface/Query';

const buildJoinClause = (joins?: JoinClause[]): string => {
	if (!joins || joins.length === 0) {
		return '';
	}

	const joinClauses = joins.map(({ table, leftColumn, rightColumn, type }) => {
		// 테이블.컬럼 형식인지 확인하고 snake_case 변환
		const formatColumn = (column: string) => {
			if (column.includes('.')) {
				const [tableName, columnName] = column.split('.');
				return `${mysql2.format('??', [tableName])}.${mysql2.format('??', [convertToSnakeString(columnName)])}`;
			}
			return mysql2.format('??', [convertToSnakeString(column)]);
		};

		const leftCol = formatColumn(leftColumn);
		const rightCol = formatColumn(rightColumn);
		const tableName = mysql2.format('??', [table]);

		return ` ${type} JOIN ${tableName} ON ${leftCol} = ${rightCol}`;
	});

	return joinClauses.join('');
};

export default buildJoinClause;


export const buildRelationJoins = (
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