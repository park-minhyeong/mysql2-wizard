export interface DbErrorInterface {
	code: string;
	errno: number;
	sqlMessage: string;
	sqlState: string;
	index: number;
	sql: string;
	sqlParameters: string[];
}
export class DbError extends Error implements DbErrorInterface {
	code: string;
	errno: number;
	sqlMessage: string;
	sqlState: string;
	index: number;
	sql: string;
	sqlParameters: string[];
	constructor({
		code,
		errno,
		index,
		sql,
		sqlMessage,
		sqlParameters,
		sqlState,
	}: DbErrorInterface) {
		super(sqlMessage);
		this.code = code;
		this.errno = errno;
		this.sqlMessage = sqlMessage;
		this.sqlState = sqlState;
		this.index = index;
		this.sql = sql;
		this.sqlParameters = sqlParameters;
	}
}

export function isDbError(
	error: unknown,
	strict?: boolean
): error is DbErrorInterface {
	if (typeof strict !== "undefined" && !strict) return true;
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string" &&
		"errno" in error &&
		typeof error.errno === "number" &&
		"sqlMessage" in error &&
		typeof error.sqlMessage === "string" &&
		"sqlState" in error &&
		typeof error.sqlState === "string" &&
		"index" in error &&
		typeof error.index === "number" &&
		"sql" in error &&
		typeof error.sql === "string"
	);
}
export class PoolError extends Error { }
