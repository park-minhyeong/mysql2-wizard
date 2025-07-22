import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from '../../utils';

const buildSelectClause = (columns?: string[], tableName?: string): string => {
	if (!columns || columns.length === 0) {
		// 기본값: 메인 테이블의 모든 컬럼
		return tableName ? `${mysql2.format('??', [tableName])}.*` : '*';
	}
	const selectColumns = columns.map(column => {
		// 이미 완성된 컬럼 표현식인지 확인 (*, table.*, functions 등)
		if (column.includes('*') || column.includes('(') || column.toUpperCase().includes(' AS ')) {
			return column;
		}

			// 테이블.컬럼 형식 처리
			if (column.includes('.')) {
				const [table, col] = column.split('.');
				if (col === '*') {
					return `${mysql2.format('??', [table])}.*`;
				}
				return `${mysql2.format('??', [table])}.${mysql2.format('??', [convertToSnakeString(col)])}`;
			}

		// 단순 컬럼명 처리
		return mysql2.format('??', [convertToSnakeString(column)]);
	});

	return selectColumns.join(', ');
};

export default buildSelectClause; 