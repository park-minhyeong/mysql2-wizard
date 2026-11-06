import mysql2 from "mysql2/promise";
import { readEnv } from "./env";
import { logger } from "../log";
import { getErrorProperty } from "./error";

export const poolConfig = readEnv();
export const pool = mysql2.createPool(poolConfig.mysql2Options);
export const dbType = poolConfig.dbType;
export const convertDateToUTC = poolConfig.convertDateToUTC;

/** mysql2 Pool 내부 큐(Denque) 길이만 읽는다. 진단 로그 전용. */
interface PoolInternals {
  _allConnections?: { length: number };
  _freeConnections?: { length: number };
  _connectionQueue?: { length: number };
}

export interface PoolStatus {
  total?: number;
  free?: number;
  queue?: number;
}

export const getPoolStatus = (): PoolStatus => {
  const internals = pool.pool as PoolInternals;
  return {
    total: internals._allConnections?.length,
    free: internals._freeConnections?.length,
    queue: internals._connectionQueue?.length,
  };
};

pool.pool.on("error", (err: unknown) => {
  logger.error("Pool error occurred");
  if (err instanceof Error) {
    logger.error(`Error message: ${err.message}`);
    logger.error(`Error stack: ${err.stack}`);
  }
  const code = getErrorProperty(err, "code");
  if (code !== undefined) logger.error(`Error code: ${String(code)}`);
  const errno = getErrorProperty(err, "errno");
  if (errno !== undefined) logger.error(`Error number: ${String(errno)}`);
});
