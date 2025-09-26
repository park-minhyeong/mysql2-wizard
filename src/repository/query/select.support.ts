import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from '../../utils';

const buildSelectClause = (columns?: string[], tableName?: string): string => {
	if (!columns || columns.length === 0) {
		// 기본값: 메인 테이블의 모든 컬럼
		return tableName ? `${mysql2.format('??', [tableName])}.*` : '*';
	}
	const selectColumns = columns.map(column => {
		if (column.includes('*') || column.includes('(') || column.toUpperCase().includes(' AS '))
			return column;
			if (column.includes('.')) {
				const [table, col] = column.split('.');
				if (col === '*') 	return `${mysql2.format('??', [table])}.*`;
				return `${mysql2.format('??', [table])}.${mysql2.format('??', [convertToSnakeString(col)])}`;
			}
		return mysql2.format('??', [convertToSnakeString(column)]);
	});
	return selectColumns.join(', ');
};

export default buildSelectClause; 