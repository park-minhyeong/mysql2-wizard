import type mysql2 from "mysql2/promise";
import { DbError, isDbError, type DbErrorInterface } from "./interface";
import { logger } from "./log";
import { getConnection, releaseConnection, runInTransaction } from "./core/connection";

export { pool, dbType, convertDateToUTC } from "./core/pool";
export { getConnection } from "./core/connection";

export type ResultSetHeader = mysql2.ResultSetHeader;
export type RowDataPacket = mysql2.RowDataPacket;

type HandlerOption = {
  throwError?: boolean;
  printSqlError?: boolean;
  rollbackIfError?: boolean;
  useTransaction?: boolean;
};

const logDbError = (e: DbErrorInterface) => {
  logger.error("SQL: " + e.sql);
  logger.error("Message: " + e.sqlMessage);
  logger.error("State: " + e.sqlState);
  logger.error("Error number: " + e.errno);
  logger.error("Code: " + e.code);
};

/**
 * 공개 handler: 기본적으로 트랜잭션을 열고(useTransaction=true) mysql2 에러를 `DbError`로 감싼다.
 * connection을 얻지 못하면 `null`을 반환한다.
 * @param callback Callback function that use connection.
 * If you want to handle error by yourself with `null`, use `option.throwError`.
 * @throws {PoolError | DbError | Error}
 */
export async function handler<T>(
  callback: (connection: mysql2.Connection) => Promise<T>,
  option: HandlerOption = {
    throwError: true,
    printSqlError: true,
    rollbackIfError: true,
    useTransaction: true,
  }
): Promise<T | null> {
  const connection = await getConnection();
  if (connection === null) return null;

  const opts = {
    throwError: option.throwError ?? true,
    printSqlError: option.printSqlError ?? true,
    rollbackIfError: option.rollbackIfError ?? true,
    useTransaction: option.useTransaction ?? true,
  };

  try {
    return await runInTransaction(connection, callback, opts.useTransaction, opts.rollbackIfError);
  } catch (e) {
    if (isDbError(e)) {
      if (opts.printSqlError) logDbError(e);
      if (opts.throwError) throw new DbError(e);
      return null;
    }
    if (opts.throwError) throw e;
    return null;
  } finally {
    releaseConnection(connection);
  }
}
