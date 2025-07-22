import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from '../../../utils';
import { JoinClause } from '../../../interface/Query';

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