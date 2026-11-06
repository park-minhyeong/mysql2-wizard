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
			// Deadlock이나 Lock wait timeout은 테스트 환경에서 흔히 발생하므로 로그 출력 생략
			const isDeadlock = error instanceof Error && (
				error.message.includes('Deadlock') ||
				error.message.includes('Lock wait timeout')
			);
			
			if (error instanceof Error && !isDeadlock) {
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
		// getConnection() null → 위에서 이미 PoolError. 그 외(SQL 등)는 원본을 유지해야 원인을 알 수 있음.
		const isDeadlock = error instanceof Error && (
			error.message.includes('Deadlock') ||
			error.message.includes('Lock wait timeout')
		);

		if (error instanceof PoolError) {
			if (throwError) throw error;
			return null as T;
		}

		if (error instanceof Error && !isDeadlock) {
			logger.error(`Connection error: ${error.message}`);
			if (error.stack) {
				logger.error(`Stack: ${error.stack}`);
			}
		}
		if (throwError) throw error;
		return null as T;
	}
}