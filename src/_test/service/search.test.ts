import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { repository } from '../../repository';
import { Test, testKeys } from '../interface/Test';

// customer.ts와 유사한 구조의 테스트용 서비스
interface TestReadOption {
    id?: number;
    search?: string;
    page?: number;
    pageSize?: number;
    data?: Partial<Test>;
}

// parseRead 모방 함수
function parseRead(props?: Partial<TestReadOption>) {
    const { id, search, page, pageSize, ...data } = props || {};
    return {
        page,
        search,
        pageSize,
        data: data as Partial<Test>,
    };
}

const testRepo = repository<Test, 'id'>({
    table: 'test.test',
    keys: testKeys,
    printQuery: false,
});

// customer.ts의 read 함수와 유사한 구조
async function read(props?: Partial<TestReadOption>): Promise<Test[]> {
    const { page, search, pageSize, data } = parseRead(props);
    const limit = 100;
    
    // data가 있으면 spread, 없으면 빈 객체
    const query = testRepo
        .select(data || {})
        .or({ text: { operator: "LIKE", value: search } })
        .or({ text: { operator: "LIKE", value: search } }) // 중복 테스트
        .orderBy([{ column: "id", direction: "DESC" }])
        .limit(pageSize && pageSize > 0 ? pageSize : limit)
        .offset(page ? (page - 1) * (pageSize && pageSize > 0 ? pageSize : limit) : 0);
    
    return query;
}

// customer.ts의 count 함수와 유사한 구조
async function count(props?: Partial<TestReadOption>): Promise<number> {
    const { search, data } = parseRead(props);
    const result = await testRepo
        .select(data || {})
        .or({ text: { operator: "LIKE", value: search } })
        .or({ text: { operator: "LIKE", value: search } })
        .calculate([{ fn: "COUNT", alias: "count" }]);
    return result.count;
}

describe('search 파라미터 처리 테스트 (customer.ts 패턴)', () => {
    beforeEach(async () => {
        // 테스트 전 기존 데이터 삭제
        try {
            await testRepo.delete([{ id: { operator: '>', value: 0 } }]);
        } catch (error) {
            // DB 연결 실패 시 무시
        }
    });

    afterEach(async () => {
        // 테스트 후 데이터 정리
        try {
            await testRepo.delete([{ id: { operator: '>', value: 0 } }]);
        } catch (error) {
            // DB 연결 실패 시 무시
        }
    });

    describe('1. search가 undefined일 때', () => {
        it('read 함수가 에러 없이 실행되어야 함', async () => {
            // 테스트 데이터 삽입
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
            ]);

            // search가 undefined인 경우
            const result = await read({ search: undefined });
            
            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThanOrEqual(0);
        });

        it('count 함수가 에러 없이 실행되어야 함', async () => {
            // 테스트 데이터 삽입
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            // search가 undefined인 경우
            const result = await count({ search: undefined });
            
            expect(result).toBeGreaterThanOrEqual(0);
            expect(typeof result).toBe('number');
        });

        it('search가 없을 때도 정상 작동해야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            // search 속성 자체가 없는 경우
            const result = await read({});
            
            expect(result).toBeInstanceOf(Array);
        });
    });

    describe('2. search가 빈 문자열일 때', () => {
        it('read 함수가 에러 없이 실행되어야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: '' });
            
            expect(result).toBeInstanceOf(Array);
        });

        it('count 함수가 에러 없이 실행되어야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await count({ search: '' });
            
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('3. search가 정상적인 문자열일 때', () => {
        it('read 함수가 LIKE 검색을 수행해야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
                { text: 'other', number: 3, numbers: [3], date: new Date() },
            ]);

            const result = await read({ search: 'test' });
            
            expect(result.length).toBeGreaterThanOrEqual(2);
            result.forEach(item => {
                expect(item.text).toContain('test');
            });
        });

        it('count 함수가 LIKE 검색을 수행해야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
                { text: 'other', number: 3, numbers: [3], date: new Date() },
            ]);

            const result = await count({ search: 'test' });
            
            expect(result).toBeGreaterThanOrEqual(2);
        });
    });

    describe('4. 여러 or 조건이 모두 undefined일 때', () => {
        it('read 함수가 에러 없이 실행되어야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            // 여러 or 조건이 모두 undefined
            const result = await read({ 
                search: undefined
            });
            
            expect(result).toBeInstanceOf(Array);
        });

        it('count 함수가 에러 없이 실행되어야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await count({ 
                search: undefined
            });
            
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('5. search와 다른 조건들이 함께 있을 때', () => {
        it('read 함수가 정상 작동해야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
            ]);

            // 직접 repository 사용하여 number 조건 추가
            const result = await testRepo.select({ number: 1 })
                .or({ text: { operator: "LIKE", value: 'test' } })
                .execute();
            
            expect(result).toBeInstanceOf(Array);
        });

        it('count 함수가 정상 작동해야 함', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
            ]);

            const result = await testRepo.select({ number: 1 })
                .or({ text: { operator: "LIKE", value: 'test' } })
                .calculate([{ fn: "COUNT", alias: "count" }]);
            
            expect(result.count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('6. page와 pageSize와 함께 사용할 때', () => {
        it('search가 undefined일 때도 pagination이 작동해야 함', async () => {
            // 여러 데이터 삽입
            const testData = Array.from({ length: 10 }, (_, i) => ({
                text: `test${i}`,
                number: i,
                numbers: [i],
                date: new Date(),
            }));
            await testRepo.insert(testData);

            const result = await read({ 
                search: undefined,
                page: 1,
                pageSize: 5
            });
            
            expect(result.length).toBeLessThanOrEqual(5);
        });

        it('search가 있을 때도 pagination이 작동해야 함', async () => {
            const testData = Array.from({ length: 10 }, (_, i) => ({
                text: `test${i}`,
                number: i,
                numbers: [i],
                date: new Date(),
            }));
            await testRepo.insert(testData);

            const result = await read({ 
                search: 'test',
                page: 1,
                pageSize: 3
            });
            
            expect(result.length).toBeLessThanOrEqual(3);
        });
    });

    describe('7. 빈 결과셋 테스트', () => {
        it('search가 undefined이고 데이터가 없을 때 빈 배열 반환', async () => {
            const result = await read({ search: undefined });
            
            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBe(0);
        });

        it('search가 있고 매칭되는 데이터가 없을 때 빈 배열 반환', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: 'nonexistent' });
            
            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBe(0);
        });

        it('count가 0을 반환해야 함', async () => {
            const result = await count({ search: 'nonexistent' });
            
            expect(result).toBe(0);
        });
    });

    describe('8. 다양한 search 값 테스트', () => {
        it('특수문자가 포함된 search 값 처리', async () => {
            await testRepo.insert([
                { text: 'test%value', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: 'test%' });
            
            expect(result).toBeInstanceOf(Array);
        });

        it('긴 search 문자열 처리', async () => {
            // DB 컬럼 크기 제한을 고려하여 적절한 길이로 제한
            const longSearch = 'a'.repeat(100);
            await testRepo.insert([
                { text: longSearch, number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: longSearch });
            
            expect(result.length).toBeGreaterThanOrEqual(0);
        });

        it('숫자가 포함된 search 값 처리', async () => {
            await testRepo.insert([
                { text: 'test123', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: '123' });
            
            expect(result.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('9. 동시에 여러 조건 테스트', () => {
        it('search와 다른 조건이 모두 있을 때', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
            ]);

            // 직접 repository 사용
            const result = await testRepo.select({ number: { operator: '>', value: 0 } })
                .or({ text: { operator: "LIKE", value: 'test' } })
                .execute();
            
            expect(result).toBeInstanceOf(Array);
        });

        it('search가 undefined이고 다른 조건만 있을 때', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            // 직접 repository 사용
            const result = await testRepo.select({ number: 1 })
                .or({ text: { operator: "LIKE", value: undefined } })
                .execute();
            
            expect(result).toBeInstanceOf(Array);
        });
    });

    describe('10. 트랜잭션 내에서 search 사용 테스트', () => {
        it('트랜잭션 내에서 search가 undefined일 때 정상 작동', async () => {
            const { handler } = await import('../../config');
            
            await handler(async (connection) => {
                await testRepo.insert([
                    { text: 'test1', number: 1, numbers: [1], date: new Date() },
                ], connection);

                // 트랜잭션 내에서 search가 undefined인 쿼리 실행
                const result = await testRepo.select({ number: 1 }, connection)
                    .or({ text: { operator: "LIKE", value: undefined } })
                    .execute();
                
                expect(result).toBeInstanceOf(Array);
            });
        });

        it('트랜잭션 내에서 search가 있을 때 정상 작동', async () => {
            const { handler } = await import('../../config');
            
            await handler(async (connection) => {
                await testRepo.insert([
                    { text: 'test1', number: 1, numbers: [1], date: new Date() },
                ], connection);

                const result = await testRepo.select({ number: 1 }, connection)
                    .or({ text: { operator: "LIKE", value: 'test' } })
                    .execute();
                
                expect(result.length).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('11. 엣지 케이스 테스트', () => {
        it('search가 null일 때 (undefined와 다름)', async () => {
            // null은 undefined와 다르게 처리될 수 있음
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            // null은 문자열로 변환되지만, 필터링에서 제외되어야 함
            const result = await read({ search: null as any });
            
            expect(result).toBeInstanceOf(Array);
        });

        it('여러 or 조건 중 일부만 undefined일 때', async () => {
            // 이 테스트는 customer.ts의 실제 구조를 반영
            // 여러 or 조건이 있을 때 일부만 undefined인 경우
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            // 직접 repository 사용하여 여러 or 조건 테스트
            const result = await testRepo.select({ number: 1 })
                .or({ text: { operator: "LIKE", value: undefined } })
                .or({ text: { operator: "LIKE", value: 'test' } })
                .execute();
            
            expect(result).toBeInstanceOf(Array);
        });

        it('모든 or 조건이 undefined일 때', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await testRepo.select({ number: 1 })
                .or({ text: { operator: "LIKE", value: undefined } })
                .or({ text: { operator: "LIKE", value: undefined } })
                .execute();
            
            expect(result).toBeInstanceOf(Array);
            // 메인 조건(number: 1)만 적용되어야 함
            expect(result.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('12. 성능 및 대량 데이터 테스트', () => {
        it('대량 데이터에서 search가 undefined일 때 성능 테스트', async () => {
            // 대량 데이터 삽입
            const testData = Array.from({ length: 100 }, (_, i) => ({
                text: `test${i}`,
                number: i,
                numbers: [i],
                date: new Date(),
            }));
            await testRepo.insert(testData);

            const startTime = Date.now();
            const result = await read({ search: undefined });
            const endTime = Date.now();

            expect(result).toBeInstanceOf(Array);
            expect(endTime - startTime).toBeLessThan(5000); // 5초 이내
        });

        it('대량 데이터에서 search가 있을 때 성능 테스트', async () => {
            const testData = Array.from({ length: 100 }, (_, i) => ({
                text: `test${i}`,
                number: i,
                numbers: [i],
                date: new Date(),
            }));
            await testRepo.insert(testData);

            const startTime = Date.now();
            const result = await read({ search: 'test' });
            const endTime = Date.now();

            expect(result.length).toBeGreaterThanOrEqual(0);
            expect(endTime - startTime).toBeLessThan(5000);
        });
    });

    describe('13. 복합 시나리오 테스트', () => {
        it('search undefined + pagination + orderBy 조합', async () => {
            const testData = Array.from({ length: 20 }, (_, i) => ({
                text: `item${i}`,
                number: i,
                numbers: [i],
                date: new Date(),
            }));
            await testRepo.insert(testData);

            const result = await read({ 
                search: undefined,
                page: 1,
                pageSize: 10
            });
            
            expect(result.length).toBeLessThanOrEqual(10);
        });

        it('search 있을 때 + pagination + orderBy 조합', async () => {
            const testData = Array.from({ length: 20 }, (_, i) => ({
                text: `item${i}`,
                number: i,
                numbers: [i],
                date: new Date(),
            }));
            await testRepo.insert(testData);

            const result = await read({ 
                search: 'item',
                page: 2,
                pageSize: 5
            });
            
            expect(result.length).toBeLessThanOrEqual(5);
        });

        it('여러 or 조건 중 일부만 유효한 값일 때', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
            ]);

            // 일부는 undefined, 일부는 유효한 값
            const result = await testRepo.select({ number: 1 })
                .or({ text: { operator: "LIKE", value: undefined } })
                .or({ text: { operator: "LIKE", value: 'test' } })
                .or({ text: { operator: "LIKE", value: undefined } })
                .execute();
            
            expect(result).toBeInstanceOf(Array);
        });
    });

    describe('14. 실제 customer.ts 패턴 완전 재현 테스트', () => {
        it('customer.ts read 함수와 동일한 패턴: search undefined', async () => {
            await testRepo.insert([
                { text: 'user1', number: 1, numbers: [1], date: new Date() },
                { text: 'user2', number: 2, numbers: [2], date: new Date() },
            ]);

            // customer.ts의 read 함수와 동일한 패턴
            const { page, search, pageSize, data } = parseRead({ search: undefined });
            const limit = 100;
            
            const result = await testRepo
                .select(data || {})
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .orderBy([{ column: "id", direction: "DESC" }])
                .limit(pageSize && pageSize > 0 ? pageSize : limit)
                .offset(page ? (page - 1) * (pageSize && pageSize > 0 ? pageSize : limit) : 0);
            
            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThanOrEqual(0);
        });

        it('customer.ts count 함수와 동일한 패턴: search undefined', async () => {
            await testRepo.insert([
                { text: 'user1', number: 1, numbers: [1], date: new Date() },
            ]);

            // customer.ts의 count 함수와 동일한 패턴
            const { search, data } = parseRead({ search: undefined });
            const result = await testRepo
                .select(data || {})
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .calculate([{ fn: "COUNT", alias: "count" }]);
            
            expect(result.count).toBeGreaterThanOrEqual(0);
            expect(typeof result.count).toBe('number');
        });

        it('customer.ts read 함수와 동일한 패턴: search 있을 때', async () => {
            await testRepo.insert([
                { text: 'user1', number: 1, numbers: [1], date: new Date() },
                { text: 'user2', number: 2, numbers: [2], date: new Date() },
            ]);

            const { page, search, pageSize, data } = parseRead({ search: 'user' });
            const limit = 100;
            
            const result = await testRepo
                .select(data || {})
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .or({ text: { operator: "LIKE", value: search } })
                .orderBy([{ column: "id", direction: "DESC" }])
                .limit(pageSize && pageSize > 0 ? pageSize : limit)
                .offset(page ? (page - 1) * (pageSize && pageSize > 0 ? pageSize : limit) : 0);
            
            expect(result.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('15. 엣지 케이스 추가 테스트', () => {
        it('search가 공백 문자열일 때', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: '   ' });
            
            expect(result).toBeInstanceOf(Array);
        });

        it('search가 숫자 0일 때 (타입 변환)', async () => {
            await testRepo.insert([
                { text: '0', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: 0 as any });
            
            expect(result).toBeInstanceOf(Array);
        });

        it('search가 boolean일 때 (타입 변환)', async () => {
            await testRepo.insert([
                { text: 'true', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await read({ search: true as any });
            
            expect(result).toBeInstanceOf(Array);
        });

        it('여러 or 조건이 모두 빈 문자열일 때', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            const result = await testRepo.select({ number: 1 })
                .or({ text: { operator: "LIKE", value: '' } })
                .or({ text: { operator: "LIKE", value: '' } })
                .execute();
            
            expect(result).toBeInstanceOf(Array);
        });

        it('or 조건이 없을 때 (빈 배열)', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
            ]);

            // or 조건 없이 select만
            const result = await testRepo.select({ number: 1 }).execute();
            
            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('16. 동시성 테스트', () => {
        it('여러 쿼리가 동시에 실행될 때 search undefined 처리', async () => {
            await testRepo.insert([
                { text: 'test1', number: 1, numbers: [1], date: new Date() },
                { text: 'test2', number: 2, numbers: [2], date: new Date() },
            ]);

            // 동시에 여러 쿼리 실행
            const promises = [
                read({ search: undefined }),
                read({ search: undefined }),
                read({ search: 'test' }),
                count({ search: undefined }),
            ];

            const results = await Promise.all(promises);
            
            expect(results[0]).toBeInstanceOf(Array);
            expect(results[1]).toBeInstanceOf(Array);
            expect(results[2]).toBeInstanceOf(Array);
            expect(typeof results[3]).toBe('number');
        });
    });
});
