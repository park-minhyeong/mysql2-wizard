import { vi } from 'vitest';
import type { Connection } from '../../interface/Repository';

export interface RecordedQuery {
	sql: string;
	values: unknown[];
}

export interface MockConnection {
	connection: Connection;
	calls: RecordedQuery[];
	beginTransaction: ReturnType<typeof vi.fn>;
	commit: ReturnType<typeof vi.fn>;
	rollback: ReturnType<typeof vi.fn>;
	release: ReturnType<typeof vi.fn>;
}

/**
 * DB 없이 SQL/바인딩을 기록하는 가짜 connection.
 * `results[i]`는 i번째 query 호출이 돌려줄 rows(또는 ResultSetHeader)이다.
 */
export function createMockConnection(results: unknown[] = []): MockConnection {
	const calls: RecordedQuery[] = [];
	let index = 0;
	const query = vi.fn(async (sql: string, values?: unknown[]) => {
		calls.push({ sql, values: values ?? [] });
		const result = results[index] ?? [];
		index += 1;
		return [result, []];
	});
	const beginTransaction = vi.fn(async () => undefined);
	const commit = vi.fn(async () => undefined);
	const rollback = vi.fn(async () => undefined);
	const release = vi.fn(() => undefined);
	const connection = {
		query,
		execute: query,
		beginTransaction,
		commit,
		rollback,
		release,
		ping: vi.fn(async () => undefined),
		destroy: vi.fn(() => undefined),
	} as unknown as Connection; // 테스트 전용 mock
	return { connection, calls, beginTransaction, commit, rollback, release };
}

export const resultSetHeader = (affectedRows: number, insertId = 0) => ({
	affectedRows,
	insertId,
	fieldCount: 0,
	info: '',
	serverStatus: 0,
	warningStatus: 0,
	changedRows: 0,
});

export interface User {
	id: number;
	userName: string;
	isActive: boolean;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
	score: number;
}
export const userKeys = ['id', 'userName', 'isActive', 'metadata', 'createdAt', 'score'] as const;
export type UserAutoSet = 'id' | 'createdAt';
