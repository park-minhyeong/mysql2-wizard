import { RowDataPacket } from 'mysql2/promise';
import { handler } from '../handler';
import mysql2 from 'mysql2/promise';
import { CompareQuery, QueryOption, SelectOption, OrderBy } from '../../interface/Query';
import { ISelectQueryBuilder } from '../../interface/Repository';
import where from './condition/where';
import orderBy from './option/orderBy';
import limit from './option/limit';

const queryString = <T>({ table }: QueryOption<T>) => ({
	selectAll: mysql2.format('SELECT * FROM ??', [table]),
	select: mysql2.format('SELECT * FROM ?? WHERE ', [table]),
});

// 체이닝 패턴 구현
export class SelectQueryBuilder<T> implements ISelectQueryBuilder<T> {
	private selectOptions: SelectOption<T> = {};
	constructor(private query: CompareQuery<T> | undefined, private option: QueryOption<T>) {}
	orderBy(orderByArray: OrderBy<T>): ISelectQueryBuilder<T> {
		this.selectOptions.orderBy = orderByArray;
		return this;
	}
	limit(limitCount: number): ISelectQueryBuilder<T> {
		this.selectOptions.limit = limitCount;
		return this;
	}
	offset(offsetCount: number): ISelectQueryBuilder<T> {
		this.selectOptions.offset = offsetCount;
		return this;
	}
	async execute(): Promise<T[]> {
		return select(this.query, this.option, this.selectOptions);
	}
	// PromiseLike 구현 - 이제 await를 어디서든 사용 가능!
	then<TResult1 = T[], TResult2 = never>(
		onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

const select = async <T>(
	query: CompareQuery<T> | undefined, 
	option: QueryOption<T>, 
	selectOptions?: SelectOption<T>
): Promise<T[]> => handler(async connection => {
	let query_: string;
	let values: unknown[] = [];

	if (!query || Object.keys(query).length === 0) {
		query_ = queryString(option).selectAll;
	} else {
		const { conditions, values: whereValues } = where(query, option);
		query_ = queryString(option).select + conditions;
		values = whereValues;
	}

	// ORDER BY 절 추가
	query_ += orderBy(selectOptions?.orderBy);

	// LIMIT/OFFSET 절 추가
	query_ += limit(selectOptions);

	option.printQueryIfNeeded?.(query_);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);
	return rows.map(row => option.toObject(row));
});

const selectOne = async <T>(
	query: CompareQuery<T>,
	option: QueryOption<T>,
	options?: { throwError?: boolean },
	selectOptions?: SelectOption<T>
): Promise<T | undefined> => handler(async connection => {
	const { conditions, values } = where(query, option);
	let query_ = queryString(option).select + conditions;

	// ORDER BY 절 추가
	query_ += orderBy(selectOptions?.orderBy);

	// LIMIT 1 자동 추가 (findOne이므로)
	query_ += ` LIMIT 1`;

	option.printQueryIfNeeded?.(query_);
	const [rows] = await connection.query<RowDataPacket[]>(query_, values);
	if (rows.length === 0) {
		if (options?.throwError) throw new Error('Not found');
		return undefined;
	}
	return option.toObject(rows[0]);
});

export { select, selectOne };
