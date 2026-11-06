import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseMysqlDatabaseUrl, readEnv, readWizardEnv, findRemovedEnvKeys, createTypeCast, type TypeCastField as Field } from '../../core/env';

describe('parseMysqlDatabaseUrl()', () => {
	it('호스트/포트/계정/DB 파싱, 기본 포트 3306', () => {
		const parsed = parseMysqlDatabaseUrl('mysql://user:p%40ss@db.example.com/app');
		expect(parsed).toMatchObject({ host: 'db.example.com', port: 3306, user: 'user', password: 'p@ss', database: 'app' });
		expect(parsed.ssl).toBeUndefined();
		expect(parsed.connectTimeoutMs).toBeUndefined();
	});

	it('mysql2: 프로토콜 허용, 그 외는 에러', () => {
		expect(parseMysqlDatabaseUrl('mysql2://u:p@h:3307/').port).toBe(3307);
		expect(() => parseMysqlDatabaseUrl('postgres://u:p@h/db')).toThrow('protocol must be mysql');
		expect(() => parseMysqlDatabaseUrl('not a url')).toThrow('not a valid URL');
	});

	it('sslaccept=strict / accept_invalid_certs', () => {
		expect(parseMysqlDatabaseUrl('mysql://u:p@h/db?sslaccept=strict').ssl).toEqual({ rejectUnauthorized: true });
		expect(parseMysqlDatabaseUrl('mysql://u:p@h/db?sslaccept=accept_invalid_certs').ssl).toEqual({ rejectUnauthorized: false });
	});

	it('sslca 파일을 읽고 ~ 를 홈으로 확장, 없는 파일은 에러', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-ssl-'));
		const caPath = path.join(dir, 'ca.pem');
		fs.writeFileSync(caPath, 'CA');
		try {
			const parsed = parseMysqlDatabaseUrl(`mysql://u:p@h/db?sslca=${encodeURIComponent(caPath)}`);
			expect(parsed.ssl?.ca?.toString()).toBe('CA');
			expect(parsed.ssl?.rejectUnauthorized).toBe(true);
			expect(() => parseMysqlDatabaseUrl('mysql://u:p@h/db?sslca=~/definitely-missing-ca.pem')).toThrow('SSL file could not be read');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it('connect_timeout(초) → ms, 음수/문자는 에러', () => {
		expect(parseMysqlDatabaseUrl('mysql://u:p@h/db?connect_timeout=5').connectTimeoutMs).toBe(5000);
		expect(() => parseMysqlDatabaseUrl('mysql://u:p@h/db?connect_timeout=-1')).toThrow('connect_timeout');
		expect(() => parseMysqlDatabaseUrl('mysql://u:p@h/db?connect_timeout=abc')).toThrow('connect_timeout');
	});
});

describe('readEnv()', () => {
	it('기본값', () => {
		const config = readEnv({});
		expect(config.mysql2Options).toMatchObject({
			host: 'localhost', user: 'root', password: '', port: 3306,
			connectionLimit: 10, queueLimit: 0, waitForConnections: true, multipleStatements: false, debug: false,
			enableKeepAlive: true, dateStrings: true,
		});
		expect(config.mysql2Options.database).toBeUndefined();
		expect(config.dbType).toBe('mysql');
		// mysql2가 인식하지 못하는 옵션은 넘기지 않는다
		expect('reconnect' in config.mysql2Options).toBe(false);
	});

	it('항상 켜진 동작은 env로 끌 수 없고, 제외된 키는 findRemovedEnvKeys 로 감지한다', () => {
		const config = readEnv({ DB_ENABLE_KEEP_ALIVE: 'false', DB_IDLE_TIMEOUT: '1', DB_CONNECTION_RETRY_COUNT: '9' });
		expect(config.mysql2Options.enableKeepAlive).toBe(true);
		expect('idleTimeout' in config.mysql2Options).toBe(false);
		expect(findRemovedEnvKeys({ DB_ENABLE_KEEP_ALIVE: 'false', DB_CONNECTION_RETRY_COUNT: '9', DB_HOST: 'h' }))
			.toEqual(['DB_ENABLE_KEEP_ALIVE', 'DB_CONNECTION_RETRY_COUNT']);
		expect(findRemovedEnvKeys({})).toEqual([]);
	});

	it('DB_URL이 개별 변수보다 우선, 나머지는 개별 변수', () => {
		const config = readEnv({
			DB_URL: 'mysql://u:p@urlhost:3310/urldb',
			DB_HOST: 'ignored', DB_PORT: '1', DB_NAME: 'ignored',
			DB_TYPE: 'MariaDB', DB_CONNECTION_LIMIT: '20', DB_WAIT_FOR_CONNECTIONS: 'false',
		});
		expect(config.mysql2Options).toMatchObject({ host: 'urlhost', port: 3310, user: 'u', password: 'p', database: 'urldb', connectionLimit: 20, waitForConnections: false });
		expect(config.dbType).toBe('mariadb');
	});

	it('숫자 env가 잘못되면 에러', () => {
		expect(() => readEnv({ DB_PORT: 'abc' })).toThrow('Invalid number value for DB_PORT');
	});

	it('typeCast 플래그는 MYSQL2_WIZARD_* 우선, 예전 이름만 있으면 fallback', () => {
		const field: Field = { type: 'TINY', length: 1, db: '', table: '', name: '', string: () => '1', buffer: () => null, geometry: () => null };
		const next = () => 'NEXT';
		const cast = (env: Record<string, string>) => readEnv(env).mysql2Options.typeCast;
		const call = (fn: ReturnType<typeof cast>) => (typeof fn === 'function' ? fn(field, next) : fn);
		expect(call(cast({ MYSQL2_WIZARD_CASTED_BOOLEAN: 'true', CASTED_BOOLEAN: 'false' }))).toBe(true);
		expect(call(cast({ CASTED_BOOLEAN: 'true' }))).toBe(true);
		expect(call(cast({ MYSQL2_WIZARD_CASTED_BOOLEAN: 'false', CASTED_BOOLEAN: 'true' }))).toBe('NEXT');
	});

	it('readWizardEnv 는 어느 키에서 읽었는지 돌려준다', () => {
		expect(readWizardEnv({ CASTED_BOOLEAN: 'true' }, 'CASTED_BOOLEAN')).toEqual({ key: 'CASTED_BOOLEAN', value: 'true' });
		expect(readWizardEnv({ MYSQL2_WIZARD_LOG_LEVEL: 'warn' }, 'LOG_LEVEL')).toEqual({ key: 'MYSQL2_WIZARD_LOG_LEVEL', value: 'warn' });
		expect(readWizardEnv({}, 'LOG_LEVEL')).toBeUndefined();
	});
});

describe('createTypeCast()', () => {
	const field = (type: Field['type'], value: string | null, length = 0): Field =>
		({ type, length, db: '', table: '', name: '', string: () => value, buffer: () => null, geometry: () => null });
	const next = () => 'NEXT';

	it('TINY(1)은 CASTED_BOOLEAN일 때만 boolean', () => {
		expect(createTypeCast({ castedBoolean: true, enableMariaDbJson: false, castedDecimalAsNumber: false })(field('TINY', '1', 1), next)).toBe(true);
		expect(createTypeCast({ castedBoolean: false, enableMariaDbJson: false, castedDecimalAsNumber: false })(field('TINY', '1', 1), next)).toBe('NEXT');
	});

	it('MariaDB JSON/BLOB은 파싱, 실패 시 원문', () => {
		const cast = createTypeCast({ castedBoolean: false, enableMariaDbJson: true, castedDecimalAsNumber: false });
		expect(cast(field('JSON', '{"a":1}'), next)).toEqual({ a: 1 });
		expect(cast(field('BLOB', 'not-json'), next)).toBe('not-json');
		expect(cast(field('JSON', null), next)).toBeNull();
	});

	it('DECIMAL 계열은 number, NaN이면 원문', () => {
		const cast = createTypeCast({ castedBoolean: false, enableMariaDbJson: false, castedDecimalAsNumber: true });
		expect(cast(field('NEWDECIMAL', '12.50'), next)).toBe(12.5);
		expect(cast(field('DOUBLE', 'abc'), next)).toBe('abc');
		expect(cast(field('VARCHAR', 'x'), next)).toBe('NEXT');
	});
});
