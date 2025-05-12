import mysql2 from "mysql2/promise";
import { PoolError } from "../interface";
import { logger } from "../log";
import { pool } from "../config";

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
		const connection = await pool.getConnection();
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
			connection.release();
		}
	} catch (error) {
		logger.error('Failed to get database connection');
		if (throwError) throw new PoolError('Failed to get database connection');
		return null as T;
	}
}