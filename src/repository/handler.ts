import type mysql2 from "mysql2/promise";
import { PoolError } from "../interface";
import { logger } from "../log";
import { getConnection, releaseConnection, runInTransaction } from "../core/connection";
import { getErrorProperty, isLockError } from "../core/error";

export interface HandlerOption {
	useTransaction?: boolean;
	throwError?: boolean;
	printSqlError?: boolean;
}

/**
 * 내부 handler: repository 쿼리(select/insert/update/delete/calculate)가 connection 없이 호출될 때 사용.
 * 공개 `handler`(config)와 달리 기본 useTransaction=false, 원본 에러를 그대로 rethrow, connection 실패 시 PoolError.
 */
export async function handler<T>(
	callback: (connection: mysql2.Connection) => Promise<T>,
	option: HandlerOption = {}
): Promise<T> {
	const { useTransaction = false, throwError = true, printSqlError = true } = option;
	const connection = await getConnection();
	if (connection === null) {
		if (throwError) throw new PoolError('Failed to get database connection');
		return null as T;
	}
	try {
		return await runInTransaction(connection, callback, useTransaction, true);
	} catch (error) {
		// Deadlock / Lock wait timeout은 로그 생략. 그 외는 원본 에러를 유지해야 원인을 알 수 있다.
		if (error instanceof Error && !isLockError(error)) {
			logger.error(error.message);
			const sql = getErrorProperty(error, 'sql');
			if (printSqlError && sql !== undefined) {
				logger.error('SQL Error: ' + error);
				logger.error('SQL Query: ' + String(sql));
			}
		}
		if (throwError) throw error;
		return null as T;
	} finally {
		releaseConnection(connection);
	}
}
