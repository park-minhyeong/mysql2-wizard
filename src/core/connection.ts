import type { Connection, PoolConnection } from "mysql2/promise";
import { logger, isLogEnabled } from "../log";
import { pool, poolConfig, getPoolStatus } from "./pool";
import { getErrorProperty } from "./error";

const isTooManyConnectionsError = (e: unknown): boolean =>
  e instanceof Error &&
  (e.message.includes("Too many connections") ||
    e.message.includes("ER_CON_COUNT_ERROR") ||
    getErrorProperty(e, "code") === "ER_CON_COUNT_ERROR" ||
    getErrorProperty(e, "errno") === 1040);

const isConnectionLostError = (e: unknown): boolean =>
  e instanceof Error &&
  (getErrorProperty(e, "code") === "PROTOCOL_CONNECTION_LOST" ||
    e.message.includes("Connection lost") ||
    e.message.includes("The server closed the connection") ||
    e.message.includes("Connection is dead"));

/**
 * 연결 실패 로그. 요약(메시지/code)은 error, 접속 설정·pool 상태·stack 같은 상세는 debug 레벨.
 */
const logConnectionFailure = (attempt: number, maxRetries: number, e: unknown): void => {
  const summary =
    e instanceof Error
      ? `${e.message}${getErrorProperty(e, "code") !== undefined ? ` (${String(getErrorProperty(e, "code"))})` : ""}`
      : `Unknown error type: ${typeof e}`;
  logger.error(`Failed to get database connection (attempt ${attempt + 1}/${maxRetries + 1}): ${summary}`);

  if (!isLogEnabled("debug")) return;

  // 연결 설정 정보 출력 (비밀번호 제외)
  const { host, port, user, database, connectionLimit, queueLimit } = poolConfig.mysql2Options;
  logger.debug(`Connection configuration: host=${host} port=${port} user=${user} database=${database || "not specified"} connectionLimit=${connectionLimit} queueLimit=${queueLimit}`);

  const status = getPoolStatus();
  logger.debug(`Pool status: total=${status.total ?? "?"} free=${status.free ?? "?"} queue=${status.queue ?? "?"}`);

  if (e instanceof Error) {
    for (const [key, label] of [
      ["errno", "errno"],
      ["sqlState", "sqlState"],
      ["sqlMessage", "sqlMessage"],
    ] as const) {
      const value = getErrorProperty(e, key);
      if (value !== undefined) logger.debug(`  ${label}: ${String(value)}`);
    }
    if (e.stack) logger.debug(`Stack: ${e.stack}`);
  } else {
    logger.debug(`Error value: ${JSON.stringify(e)}`);
  }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Pool에서 살아있는 connection을 얻는다. "Too many connections" / "Connection lost"는 지수 백오프로 재시도.
 * 실패하면 null (호출자가 PoolError 처리).
 */
export async function getConnection(): Promise<PoolConnection | null> {
  const maxRetries = poolConfig.connectionRetryCount;
  const baseDelay = poolConfig.connectionRetryDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const connection = await pool.getConnection();
      if (poolConfig.pingOnAcquire) {
        try {
          // 죽은 connection(PROTOCOL_CONNECTION_LOST) 방지
          await connection.ping();
        } catch {
          try {
            connection.destroy();
          } catch {
            // 이미 닫힌 소켓이면 무시
          }
          throw new Error("Connection is dead, retrying...");
        }
      }
      return connection;
    } catch (e) {
      const retryable = isTooManyConnectionsError(e) || isConnectionLostError(e);
      if (attempt === maxRetries || !retryable) {
        logConnectionFailure(attempt, maxRetries, e);
        return null;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      const reason = isTooManyConnectionsError(e) ? "Too many connections" : "Connection lost";
      logger.warn(`${reason} detected (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  return null;
}

export const releaseConnection = (connection: PoolConnection): void => {
  connection.release();
};

/**
 * 트랜잭션 코어. useTransaction이면 begin → callback → commit, 실패 시 (rollbackIfError) rollback 후 rethrow.
 * 공개 `handler`(config)와 내부 `handler`(repository)가 공유한다.
 */
export async function runInTransaction<T>(
  connection: Connection,
  callback: (connection: Connection) => Promise<T>,
  useTransaction: boolean,
  rollbackIfError: boolean
): Promise<T> {
  if (useTransaction) await connection.beginTransaction();
  try {
    const result = await callback(connection);
    if (useTransaction) await connection.commit();
    return result;
  } catch (error) {
    if (useTransaction && rollbackIfError) await connection.rollback();
    throw error;
  }
}
