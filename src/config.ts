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
  const enableMariaDbJson = readBooleanEnv(process.env, 'ENABLE_MARIADB_JSON', false);
  const castedDecimalAsNumber = readBooleanEnv(process.env, 'CASTED_DECIMAL_AS_NUMBER', true);
  const dbType = readStringEnv(process.env, 'DB_TYPE', 'mysql').toLowerCase();
  const connectionRetryCount = readNumberEnv(process.env, 'DB_CONNECTION_RETRY_COUNT', 3);
  const connectionRetryDelay = readNumberEnv(process.env, 'DB_CONNECTION_RETRY_DELAY', 1000);

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
    dbType,
    connectionRetryCount,
    connectionRetryDelay,
    dateStrings: true, // DATETIME/TIMESTAMP를 문자열로 받아서 타임존 변환 없이 처리
    typeCast: function (field: any, next: any) {
      if (field.type === "TINY" && field.length === 1 && castedBoolean) {
        return field.string() === "1"; // 1 = true, 0 = false
      }
      
      // MariaDB JSON 필드 처리 (환경 변수로 활성화)
      if (enableMariaDbJson && (field.type === "JSON" || field.type === "BLOB")) {
        const value = field.string();
        if (value === null || value === undefined) {
          return null;
        }
        try {
          return JSON.parse(value);
        } catch (error) {
          // JSON 파싱 실패 시 원본 문자열 반환
          return value;
        }
      }
      
      // DECIMAL/NEWDECIMAL/FLOAT/DOUBLE을 숫자로 캐스팅 (환경 변수로 활성화)
      if (castedDecimalAsNumber) {
        const decimalTypes = ["DECIMAL", "NEWDECIMAL", "FLOAT", "DOUBLE"];
        if (decimalTypes.includes(field.type)) {
          const value = field.string();
          if (value === null || value === undefined) {
            return null;
          }
          const num = Number(value);
          return Number.isNaN(num) ? value : num;
        }
      }
      
      return next();
    },
  };
};

const poolOption = readEnv();
export const pool = mysql2.createPool(poolOption);
export const dbType = poolOption.dbType;

// Pool 에러 이벤트 리스너 추가 (타입 캐스팅 필요)
(pool as any).on?.('error', (err: Error) => {
  logger.error("Pool error occurred");
  logger.error(`Error message: ${err.message}`);
  logger.error(`Error stack: ${err.stack}`);
  if ('code' in err) {
    logger.error(`Error code: ${(err as any).code}`);
  }
  if ('errno' in err) {
    logger.error(`Error number: ${(err as any).errno}`);
  }
});

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
  const maxRetries = poolOption.connectionRetryCount;
  const baseDelay = poolOption.connectionRetryDelay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await pool.getConnection();
    } catch (e) {
      const isTooManyConnections = 
        (e instanceof Error && 
         (e.message.includes('Too many connections') || 
          e.message.includes('ER_CON_COUNT_ERROR') ||
          (e as any).code === 'ER_CON_COUNT_ERROR' ||
          (e as any).errno === 1040));
      
      // 마지막 시도이거나 "Too many connections"가 아닌 경우 상세 로그 출력
      if (attempt === maxRetries || !isTooManyConnections) {
        logger.error(`Failed to get database connection (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        // 연결 설정 정보 출력 (비밀번호 제외)
        logger.error("Connection configuration:");
        logger.error(`  Host: ${poolOption.host}`);
        logger.error(`  Port: ${poolOption.port}`);
        logger.error(`  User: ${poolOption.user}`);
        logger.error(`  Database: ${poolOption.database || 'not specified'}`);
        logger.error(`  Connection Limit: ${poolOption.connectionLimit}`);
        logger.error(`  Queue Limit: ${poolOption.queueLimit}`);
        
        // Pool 상태 정보 (가능한 경우에만)
        try {
          const poolInternal = pool as any;
          logger.error("Pool status:");
          if (poolInternal._allConnections) {
            logger.error(`  Total connections: ${poolInternal._allConnections.length || 0}`);
          }
          if (poolInternal._freeConnections) {
            logger.error(`  Free connections: ${poolInternal._freeConnections.length || 0}`);
          }
          if (poolInternal._connectionQueue) {
            logger.error(`  Queue length: ${poolInternal._connectionQueue.length || 0}`);
          }
        } catch (statusError) {
          logger.error("  Unable to retrieve pool status");
        }
        
        // 에러 상세 정보
        if (e instanceof Error) {
          logger.error("Error details:");
          logger.error(`  Message: ${e.message}`);
          logger.error(`  Stack: ${e.stack}`);
          
          // MySQL 에러인 경우 추가 정보
          if ('code' in e) {
            logger.error(`  Code: ${(e as any).code}`);
          }
          if ('errno' in e) {
            logger.error(`  Error Number: ${(e as any).errno}`);
          }
          if ('sqlState' in e) {
            logger.error(`  SQL State: ${(e as any).sqlState}`);
          }
          if ('sqlMessage' in e) {
            logger.error(`  SQL Message: ${(e as any).sqlMessage}`);
          }
        } else {
          logger.error(`  Unknown error type: ${typeof e}`);
          logger.error(`  Error value: ${JSON.stringify(e)}`);
        }
      } else {
        // "Too many connections" 에러이고 재시도 가능한 경우
        const delay = baseDelay * Math.pow(2, attempt); // 지수 백오프
        logger.error(`Too many connections detected (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return null;
    }
  }
  
  return null;
}
