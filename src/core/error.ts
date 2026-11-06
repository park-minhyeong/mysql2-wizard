/** unknown 에러에서 특정 속성을 안전하게 읽는다 (mysql2 에러의 code/errno/sql 등). */
export const getErrorProperty = (error: unknown, key: string): unknown => {
  if (typeof error !== "object" || error === null) return undefined;
  if (!(key in error)) return undefined;
  return (error as Record<string, unknown>)[key];
};

/** Deadlock / Lock wait timeout 여부 (테스트 환경에서 흔해 로그를 생략한다). */
export const isLockError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("Deadlock") || error.message.includes("Lock wait timeout"));
