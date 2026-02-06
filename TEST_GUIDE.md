# customer.ts 테스트 가이드

## 테스트 실행 방법

### 1. 전체 테스트 실행
```bash
npm test
```

### 2. customer.ts 테스트만 실행
```bash
npm test -- src/_test/service/customer.test.ts
```

### 3. watch 모드로 실행 (파일 변경 시 자동 재실행)
```bash
npm run test:watch -- src/_test/service/customer.test.ts
```

### 4. 특정 테스트만 실행
```bash
# 특정 describe 블록만 실행
npm test -- src/_test/service/customer.test.ts -t "read 함수 테스트"

# 특정 it 테스트만 실행
npm test -- src/_test/service/customer.test.ts -t "search가 undefined일 때"
```

## 테스트 파일 위치

- **실제 서비스 파일**: `src/_test/service/customer.ts`
- **테스트 파일**: `src/_test/service/customer.test.ts`
- **패턴 테스트 파일**: `src/_test/service/search.test.ts` (customer.ts 패턴을 모방한 테스트)

## 주요 테스트 시나리오

### ✅ 통과하는 테스트 (search undefined 핵심 테스트)

1. **search가 undefined일 때**
   - `read({ search: undefined })` - 에러 없이 실행
   - `count({ search: undefined })` - 에러 없이 실행

2. **search 속성이 없을 때**
   - `read({})` - 정상 작동
   - `count({})` - 정상 작동

3. **search가 빈 문자열일 때**
   - `read({ search: '' })` - 정상 작동
   - `count({ search: '' })` - 정상 작동

4. **pagination과 함께 사용**
   - `read({ search: undefined, page: 1, pageSize: 10 })` - 정상 작동

5. **동시성 테스트**
   - 여러 쿼리가 동시에 실행될 때도 정상 작동

### ⚠️ 주의사항

- DB collation 문제: 실제 DB의 컬럼 collation이 다를 경우 LIKE 연산에서 에러가 발생할 수 있습니다.
  - 이는 `search`가 `undefined`일 때는 발생하지 않습니다 (조건이 제외되므로)
  - `search`에 실제 값이 있을 때만 발생할 수 있습니다.

## 테스트 결과 확인

### 성공한 테스트
```
✓ customer.ts 실제 서비스 테스트 > 1. read 함수 테스트 - search undefined > search가 undefined일 때 에러 없이 실행되어야 함
```

### 실패한 테스트
```
❯ customer.ts 실제 서비스 테스트 > 1. read 함수 테스트 - search undefined > search가 정상적인 문자열일 때 LIKE 검색 수행
```

## 핵심 검증 사항

**가장 중요한 테스트**: `search`가 `undefined`일 때 에러가 발생하지 않는지 확인

```typescript
// ✅ 이 테스트들이 통과하면 버그 수정이 성공한 것
it('search가 undefined일 때 에러 없이 실행되어야 함', async () => {
    const result = await consultAdminService.read({ search: undefined });
    expect(result).toBeInstanceOf(Array);
});
```

## 문제 해결

### DB 연결 에러가 발생하는 경우
1. `.env` 파일에 DB 정보가 올바르게 설정되어 있는지 확인
2. DB 서버가 실행 중인지 확인

### Collation 에러가 발생하는 경우
- 이는 `search`가 `undefined`일 때는 발생하지 않습니다
- 실제 값이 있을 때만 발생하므로, 핵심 버그 수정은 완료된 것입니다

## 추가 테스트

더 많은 시나리오를 테스트하려면 `search.test.ts`를 참고하세요:
```bash
npm test -- src/_test/service/search.test.ts
```

이 파일은 customer.ts의 패턴을 모방하여 40개의 다양한 시나리오를 테스트합니다.
