import mysql2 from 'mysql2/promise';
import { convertToSnakeString } from '../../../utils';
import { OrderBy } from '../../../interface/Query';

const orderBy = <T>(orderByArray?: OrderBy<T>): string => {
	if (!orderByArray || orderByArray.length === 0) {
		return '';
	}

	const orderClauses = orderByArray.map(({ column, direction }) => {
		const snakeKey = convertToSnakeString(String(column));
		return `${mysql2.format('??', [snakeKey])} ${direction}`;
	});

	return ` ORDER BY ${orderClauses.join(', ')}`;
};

export default orderBy;