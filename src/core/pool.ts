import mysql2 from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { readEnv, type PoolRuntimeConfig } from "./env";
import { logger } from "../log";
import { getErrorProperty } from "./error";

export const poolConfig = readEnv();

/**
 * Pool은 프로세스당 하나만 둔다.
 * Next.js dev(HMR)·ts-node watch처럼 모듈이 재평가되는 환경에서 모듈 스코프에만 두면 reload마다 새 pool이 생기고
 * 이전 pool의 connection은 회수되지 않는다. globalThis에 설정 서명별로 캐시해 재사용한다.
 */
const POOL_CACHE_KEY = Symbol.for("mysql2-wizard.pool");

interface PoolCacheEntry {
  signature: string;
  pool: Pool;
}

type GlobalWithPoolCache = typeof globalThis & { [POOL_CACHE_KEY]?: PoolCacheEntry };

const poolSignature = (config: PoolRuntimeConfig): string => {
  // typeCast(함수)는 env 플래그로만 달라지므로 나머지 옵션으로 충분히 식별된다
  const { typeCast: _typeCast, ...rest } = config.mysql2Options;
  return JSON.stringify(rest);
};

const getOrCreatePool = (): Pool => {
  const globalRef = globalThis as GlobalWithPoolCache;
  const signature = poolSignature(poolConfig);
  const cached = globalRef[POOL_CACHE_KEY];
  if (cached && cached.signature === signature) {
    logger.debug("Reusing cached connection pool");
    return cached.pool;
  }
  if (cached) {
    // 설정이 바뀐 경우에만 이전 pool을 닫는다 (진행 중 쿼리는 끝난 뒤 종료)
    cached.pool.end().catch((e: unknown) => logger.debug(`Previous pool end failed: ${e instanceof Error ? e.message : String(e)}`));
  }
  const pool = mysql2.createPool(poolConfig.mysql2Options);
  globalRef[POOL_CACHE_KEY] = { signature, pool };
  return pool;
};

export const pool = getOrCreatePool();
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

// 리스너는 pool 인스턴스당 한 번만
if (pool.pool.listenerCount("error") === 0) {
  pool.pool.on("error", (err: unknown) => {
    const code = getErrorProperty(err, "code");
    logger.error(`Pool error: ${err instanceof Error ? err.message : String(err)}${code !== undefined ? ` (${String(code)})` : ""}`);
    if (err instanceof Error && err.stack) logger.debug(`Stack: ${err.stack}`);
  });
}
