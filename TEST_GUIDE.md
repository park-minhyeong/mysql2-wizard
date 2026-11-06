# 테스트 가이드

테스트는 두 종류로 나뉜다.

| 종류 | 위치 | DB 필요 | 실행 |
|------|------|---------|------|
| 단위 테스트 | `src/_test/unit/` | 없음 (mock connection으로 SQL/바인딩 검증) | `npm run test:unit` |
| 통합 테스트 | `src/_test/integration/` | 필요 (`.env`) | `npm run test:integration` |

`npm test`는 둘 다 실행한다.

## 단위 테스트

DB 없이 다음을 검증한다.

- `where.test.ts` — WHERE 절 생성 (IN / LIKE / IN_JSON / null / OR)
- `clauses.test.ts` — ORDER BY, LIMIT/OFFSET, SELECT 컬럼, JOIN, relation → JOIN
- `utils.test.ts` — `toRow` / `toObject` 휴리스틱 변환 (snake_case, boolean, JSON, Date)
- `column-types.test.ts` — `columnTypes` 명시적 변환
- `repository-sql.test.ts` — `repository()`가 만드는 실제 SELECT / INSERT / UPDATE / DELETE 문과 relation 매핑
- `calculate*.test.ts` — 집계 쿼리 (MySQL / MariaDB 분기)
- `handler.test.ts` — 공개 `handler`(config)와 내부 handler의 트랜잭션·에러·release 동작
- `env.test.ts` — `DB_URL` 파싱, env 기본값, `typeCast`

가짜 connection은 `src/_test/unit/helpers.ts`의 `createMockConnection()`을 사용한다. repository 메서드에 connection을 넘기면 pool을 거치지 않으므로 SQL 문자열과 바인딩 값을 그대로 캡처할 수 있다.

```bash
npm run test:unit
npm run test:unit -- -t "columnTypes"
```

## 통합 테스트

`.env`의 DB에 접속한다. `transaction.test.ts` / `search.test.ts`는 `test.test` 테이블을 사용하며 **`id`가 AUTO_INCREMENT PRIMARY KEY**여야 한다.

```sql
CREATE DATABASE IF NOT EXISTS test;
CREATE TABLE IF NOT EXISTS test.test (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  text VARCHAR(100) DEFAULT NULL,
  number INT NOT NULL,
  numbers VARCHAR(100) NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`id`에 AUTO_INCREMENT가 없으면 모든 insert가 `Field 'id' doesn't have a default value`로 실패한다.

`customer.test.ts`는 TOSEL `cs` 스키마(`@edu-tosel/interface`)에 의존하는 서비스 예제 테스트다.

로컬에서 격리된 DB로 돌리려면 (docker):

```bash
docker run -d --rm --name mw-test -e MARIADB_ROOT_PASSWORD=test -p 127.0.0.1:33306:3306 mariadb:11
# 위 CREATE TABLE 실행 후
DB_URL= DB_HOST=127.0.0.1 DB_PORT=33306 DB_USER=root DB_PASSWORD=test DB_NAME=test DB_TYPE=mariadb \
  npm run test:integration -- src/_test/integration/transaction.test.ts src/_test/integration/search.test.ts
```

통합 테스트 파일들은 같은 테이블을 `beforeEach`에서 비우므로 `vitest.config.ts`에서 `fileParallelism: false`로 직렬 실행한다.

## 기타

```bash
npm run test:watch        # watch 모드
npm run test:coverage     # 커버리지
npm run typecheck         # 테스트 포함 전체 타입체크
```
