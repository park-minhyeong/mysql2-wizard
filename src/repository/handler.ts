import mysql2 from "mysql2/promise";
import { PoolError } from "../interface";
import { logger } from "../log";
import { getConnection } from "../config";

export interface HandlerOption {
	useTransaction?: boolean;
	throwError?: boolean;
	printSqlError?: boolean;
}

export async function handler<T>(
	callback: (connection: mysql2.Connection) => Promise<T>,
	option: HandlerOption = {}
): Promise<T> {
	const { useTransaction = false, throwError = true, printSqlError = true } = option;
	try {
		const connection = await getConnection();
		if (connection === null) {
			if (throwError) throw new PoolError('Failed to get database connection');
			return null as T;
		}
		try {
			if (useTransaction) await connection.beginTransaction();
			const result = await callback(connection);
			if (useTransaction) await connection.commit();
			return result;
		} catch (error) {
			if (error instanceof Error) {
				logger.error(error.message);
				if (printSqlError && 'sql' in error) {
					logger.error('SQL Error: ' + error);
					logger.error('SQL Query: ' + (error as any).sql);
				}
			}
			if (useTransaction) await connection.rollback();
			if (throwError) throw error;
			return null as T;
		} finally {
			// 연결 반환 시 마지막 사용 시간 업데이트
			(connection as any)._lastUse = Date.now();
			connection.release();
		}
	} catch (error) {
		// getConnection()에서 이미 상세 로그가 출력되었으므로 여기서는 간단한 메시지만
		// 하지만 error 객체에 추가 정보가 있다면 출력
		if (error instanceof Error && error.message !== 'Failed to get database connection') {
			logger.error(`Connection error: ${error.message}`);
			if (error.stack) {
				logger.error(`Stack: ${error.stack}`);
			}
		}
		if (throwError) throw new PoolError('Failed to get database connection');
		return null as T;
	}
}