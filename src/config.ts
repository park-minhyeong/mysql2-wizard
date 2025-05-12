import mysql2 from "mysql2/promise";
import { DbError, PoolError, isDbError } from "./interface";
import { logger } from "./log";

export type ResultSetHeader = mysql2.ResultSetHeader;
export type RowDataPacket = mysql2.RowDataPacket;

const readBooleanEnv = (
  record: Record<string, string | undefined>,
  key: string,
  defaultValue: boolean
): boolean => {
  const value = record[key];
  if (value === undefined) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
};

const readNumberEnv = (
  record: Record<string, string | undefined>,
  key: string,
  defaultValue: number
): number => {
  const value = record[key];
  if (value === undefined) return defaultValue;
  const number = Number(value);
  if (isNaN(number)) throw new Error(`Invalid number value for ${key}: ${value}`);
  return number;
};

const readStringEnv = (
  record: Record<string, string | undefined>,
  key: string,
  defaultValue: string
): string => {
  const value = record[key];
  if (value === undefined) return defaultValue;
  return value;
};

const readEnv = () => {
  const host = readStringEnv(process.env, 'DB_HOST', 'localhost');
  const user = readStringEnv(process.env, 'DB_USER', 'root');
  const password = readStringEnv(process.env, 'DB_PASSWORD', '');
  const database = process.env.DB_NAME;
  const port = readNumberEnv(process.env, 'DB_PORT', 3306);
  const connectionLimit = readNumberEnv(process.env, 'DB_CONNECTION_LIMIT', 10);
  const queueLimit = readNumberEnv(process.env, 'DB_QUEUE_LIMIT', 0);
  const waitForConnections = readBooleanEnv(process.env, 'DB_WAIT_FOR_CONNECTIONS', true);
  const multipleStatements = readBooleanEnv(process.env, 'DB_MULTIPLE_STATEMENTS', false);
  const debug = readBooleanEnv(process.env, 'DB_DEBUG', false);
  const castedBoolean = readBooleanEnv(process.env, 'CASTED_BOOLEAN', false);

  return {
    host,
    user,
    password,
    ...(database ? { database } : {}),
    port,
    connectionLimit,
    queueLimit,
    waitForConnections,
    multipleStatements,
    debug,
    typeCast: function (field: any, next: any) {
      if (field.type === "TINY" && field.length === 1 && castedBoolean) {
        return field.string() === "1"; // 1 = true, 0 = false
      }
      return next();
    },
  };
};

const poolOption = readEnv();
export const pool = mysql2.createPool(poolOption);

type HandlerOption = {
  throwError?: boolean;
  printSqlError?: boolean;
  rollbackIfError?: boolean;
  useTransaction?: boolean;
};

/**
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
  if (option.useTransaction) await connection.beginTransaction();
  try {
    const response = await callback(connection);
    if (option.useTransaction) await connection.commit();
    return response;
  } catch (e) {
    if (option.useTransaction && option.rollbackIfError)
      await connection.rollback();
    if (isDbError(e)) {
      if (option.printSqlError) {
        logger.error("SQL: " + e.sql);
        logger.error("Message: " + e.sqlMessage);
        logger.error("State: " + e.sqlState);
        logger.error("Error number: " + e.errno);
        logger.error("Code: " + e.code);
      }
      if (option?.throwError) throw new DbError(e);
      return null;
    }
    if (option?.throwError) throw e;
    return null;
  } finally {
    connection.release();
  }
}

async function getConnection() {
  try {
    return await pool.getConnection();
  } catch (e) {
    logger.error("Failed to get database connection");
    if (e instanceof Error) {
      logger.error(e.message);
    }
    return null;
  }
}
