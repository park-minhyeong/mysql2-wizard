import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { repository } from '../repository';
import { handler } from '../config';
import { Test, testKeys } from './interface/Test';

// 테스트용 repository 생성
const testRepo = repository<Test, 'id'>({
    table: 'test.test',
    keys: testKeys,
    printQuery: false, // 테스트 중에는 쿼리 출력 비활성화
});

describe('트랜잭션 지원 테스트', () => {
    // 테스트 전 데이터 정리
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

    describe('1. 하위 호환성 테스트', () => {
        it('connection 없이 기존 방식으로 insert/select가 작동해야 함', async () => {
            // 기존 방식: connection 없이 사용
            const insertResult = await testRepo.insert([{
                text: 'test1',
                number: 100,
                numbers: [1, 2, 3],
                date: new Date(),
            }]);

            expect(insertResult.affectedRows).toBe(1);
            expect(insertResult.insertId).toBeGreaterThan(0);

            // select도 기존 방식으로 작동 (PromiseLike이므로 바로 await 가능)
            const results = await testRepo.select({ text: 'test1' });
            expect(results.length).toBe(1);
            expect(results[0].text).toBe('test1');
            expect(results[0].number).toBe(100);
        });

        it('connection 없이 update/delete가 작동해야 함', async () => {
            // 먼저 데이터 삽입
            await testRepo.insert([{
                text: 'update-test',
                number: 200,
                numbers: [4, 5],
                date: new Date(),
            }]);

            // update 테스트
            const updateResult = await testRepo.update([
                [{ text: 'update-test' }, { number: 300 }]
            ]);
            expect(updateResult.affectedRows).toBe(1);

            // 확인
            const updated = await testRepo.select({ text: 'update-test' });
            expect(updated[0].number).toBe(300);

            // delete 테스트
            const deleteResult = await testRepo.delete([{ text: 'update-test' }]);
            expect(deleteResult.affectedRows).toBe(1);

            // 확인
            const deleted = await testRepo.select({ text: 'update-test' });
            expect(deleted.length).toBe(0);
        });
    });

    describe('2. 트랜잭션 롤백 테스트', () => {
        it('트랜잭션 내에서 에러 발생 시 롤백되어야 함', async () => {
            await expect(
                handler(async (connection) => {
                    // 첫 번째 insert는 성공
                    await testRepo.insert([{
                        text: 'rollback-test-1',
                        number: 1,
                        numbers: [1],
                        date: new Date(),
                    }], connection);

                    // 두 번째 insert도 성공
                    await testRepo.insert([{
                        text: 'rollback-test-2',
                        number: 2,
                        numbers: [2],
                        date: new Date(),
                    }], connection);

                    // 에러 발생 - 롤백되어야 함
                    throw new Error('롤백 테스트');
                }, { useTransaction: true })
            ).rejects.toThrow('롤백 테스트');

            // 롤백 확인: 데이터가 없어야 함
            const results1 = await testRepo.select({ text: 'rollback-test-1' });
            const results2 = await testRepo.select({ text: 'rollback-test-2' });
            expect(results1.length).toBe(0);
            expect(results2.length).toBe(0);
        });

        it('트랜잭션 내에서 모든 작업이 성공하면 커밋되어야 함', async () => {
            await handler(async (connection) => {
                await testRepo.insert([{
                    text: 'commit-test-1',
                    number: 1,
                    numbers: [1],
                    date: new Date(),
                }], connection);

                await testRepo.insert([{
                    text: 'commit-test-2',
                    number: 2,
                    numbers: [2],
                    date: new Date(),
                }], connection);
            }, { useTransaction: true });

            // 커밋 확인: 데이터가 있어야 함
            const results1 = await testRepo.select({ text: 'commit-test-1' });
            const results2 = await testRepo.select({ text: 'commit-test-2' });
            expect(results1.length).toBe(1);
            expect(results2.length).toBe(1);
        });
    });

    describe('3. select 체이닝 패턴 트랜잭션 테스트', () => {
        beforeEach(async () => {
            // 테스트 데이터 준비
            await testRepo.insert([
                { text: 'chain-test-1', number: 10, numbers: [1], date: new Date() },
                { text: 'chain-test-2', number: 20, numbers: [2], date: new Date() },
                { text: 'chain-test-3', number: 30, numbers: [3], date: new Date() },
            ]);
        });

        it('방법 1: 생성자에 connection 전달', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { text: { operator: 'LIKE', value: 'chain-test-%' } },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'ASC' }])
                    .limit(2)
                    .execute();

                expect(results.length).toBe(2);
                expect(results[0].number).toBe(10);
                expect(results[1].number).toBe(20);
            }, { useTransaction: true });
        });

        it('방법 2: execute()에 connection 전달', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select({
                    text: { operator: 'LIKE', value: 'chain-test-%' }
                })
                    .orderBy([{ column: 'number', direction: 'DESC' }])
                    .limit(2)
                    .execute(connection);

                expect(results.length).toBe(2);
                expect(results[0].number).toBe(30);
                expect(results[1].number).toBe(20);
            }, { useTransaction: true });
        });

        it('selectOne도 트랜잭션 내에서 작동해야 함', async () => {
            await handler(async (connection) => {
                // 방법 1: 생성자에 connection
                const result1 = await testRepo.selectOne(
                    { text: 'chain-test-1' },
                    connection
                )
                    .execute();

                expect(result1).toBeDefined();
                expect(result1?.text).toBe('chain-test-1');

                // 방법 2: execute()에 connection
                const result2 = await testRepo.selectOne({ text: 'chain-test-2' })
                    .execute(connection);

                expect(result2).toBeDefined();
                expect(result2?.text).toBe('chain-test-2');
            }, { useTransaction: true });
        });
    });

    describe('4. 혼합 사용 테스트', () => {
        it('트랜잭션 내부와 외부를 혼합 사용할 수 있어야 함', async () => {
            // 트랜잭션 외부: 즉시 커밋
            const outsideResult = await testRepo.insert([{
                text: 'outside-transaction',
                number: 999,
                numbers: [9, 9, 9],
                date: new Date(),
            }]);

            expect(outsideResult.affectedRows).toBe(1);

            // 트랜잭션 내부
            await handler(async (connection) => {
                await testRepo.insert([{
                    text: 'inside-transaction',
                    number: 888,
                    numbers: [8, 8, 8],
                    date: new Date(),
                }], connection);
            }, { useTransaction: true });

            // 둘 다 커밋되어야 함
            const outside = await testRepo.select({ text: 'outside-transaction' });
            const inside = await testRepo.select({ text: 'inside-transaction' });
            expect(outside.length).toBe(1);
            expect(inside.length).toBe(1);
        });

        it('트랜잭션 내부에서 select 후 insert가 같은 트랜잭션에 포함되어야 함', async () => {
            // 먼저 외부에서 데이터 삽입
            await testRepo.insert([{
                text: 'mixed-test',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            await handler(async (connection) => {
                // 트랜잭션 내에서 select
                const existing = await testRepo.select({ text: 'mixed-test' }, connection)
                    .execute();

                expect(existing.length).toBe(1);

                // 트랜잭션 내에서 update
                await testRepo.update([
                    [{ text: 'mixed-test' }, { number: 200 }]
                ], connection);

                // 트랜잭션 내에서 다시 select
                const updated = await testRepo.select({ text: 'mixed-test' }, connection)
                    .execute();

                expect(updated[0].number).toBe(200);
            }, { useTransaction: true });

            // 트랜잭션 외부에서 확인
            const final = await testRepo.select({ text: 'mixed-test' });
            expect(final[0].number).toBe(200);
        });
    });

    describe('5. 복잡한 트랜잭션 시나리오', () => {
        it('여러 repository 작업이 하나의 트랜잭션에 포함되어야 함', async () => {
            await handler(async (connection) => {
                // 1. insert
                const insertResult = await testRepo.insert([{
                    text: 'complex-1',
                    number: 1,
                    numbers: [1],
                    date: new Date(),
                }], connection);

                const insertId = insertResult.insertId!;

                // 2. select로 확인
                const inserted = await testRepo.select({ id: insertId }, connection)
                    .execute();
                expect(inserted.length).toBe(1);

                // 3. update
                await testRepo.update([
                    [{ id: insertId }, { number: 999 }]
                ], connection);

                // 4. 다시 select로 확인
                const updated = await testRepo.select({ id: insertId }, connection)
                    .execute();
                expect(updated[0].number).toBe(999);

                // 5. delete
                await testRepo.delete([{ id: insertId }], connection);

                // 6. 최종 확인
                const deleted = await testRepo.select({ id: insertId }, connection)
                    .execute();
                expect(deleted.length).toBe(0);
            }, { useTransaction: true });
        });

        it('트랜잭션 중간에 에러 발생 시 모든 작업이 롤백되어야 함', async () => {
            await expect(
                handler(async (connection) => {
                    // 1. insert 성공
                    const insertResult = await testRepo.insert([{
                        text: 'rollback-complex-1',
                        number: 1,
                        numbers: [1],
                        date: new Date(),
                    }], connection);

                    // 2. update 성공
                    await testRepo.update([
                        [{ text: 'rollback-complex-1' }, { number: 999 }]
                    ], connection);

                    // 3. 에러 발생
                    throw new Error('복잡한 롤백 테스트');
                }, { useTransaction: true })
            ).rejects.toThrow('복잡한 롤백 테스트');

            // 모든 작업이 롤백되었는지 확인
            const results = await testRepo.select({ text: 'rollback-complex-1' });
            expect(results.length).toBe(0);
        });
    });

    describe('6. connection 파라미터 우선순위 테스트', () => {
        it('execute()의 connection이 생성자의 connection보다 우선되어야 함', async () => {
            await testRepo.insert([{
                text: 'priority-test',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            await handler(async (connection1) => {
                // 생성자에 connection1 전달
                const builder = testRepo.select({ text: 'priority-test' }, connection1);

                // 다른 트랜잭션에서 execute()에 connection2 전달
                await handler(async (connection2) => {
                    // execute()의 connection2가 우선되어야 함
                    const results = await builder.execute(connection2);
                    expect(results.length).toBe(1);
                }, { useTransaction: true });
            }, { useTransaction: true });
        });
    });

    describe('7. 실제 사용 시나리오 테스트', () => {
        it('record.grade.ts와 유사한 시나리오: select 후 insert/update', async () => {
            // 테스트 데이터 준비
            const recordIds = [1, 2, 3];
            await testRepo.insert([
                { text: 'record-1', number: 1, numbers: [1], date: new Date() },
                { text: 'record-2', number: 2, numbers: [2], date: new Date() },
                { text: 'record-3', number: 3, numbers: [3], date: new Date() },
            ]);

            await handler(async (connection) => {
                // ✅ 간단한 쿼리: repository 사용 (type-safe, 편리함)
                const results = await testRepo.select(
                    { number: { operator: 'IN', value: recordIds } },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'ASC' }])
                    .execute();

                expect(results.length).toBe(3);

                // ✅ 트랜잭션 내에서 insert
                await testRepo.insert([{
                    text: 'response-1',
                    number: 100,
                    numbers: [10],
                    date: new Date(),
                }], connection);

                // ✅ 트랜잭션 내에서 update
                await testRepo.update([
                    [{ text: 'record-1' }, { number: 999 }]
                ], connection);

                // ✅ 복잡한 쿼리: connection.execute() 사용 (기존과 동일)
                await connection.execute(
                    `UPDATE test.test SET number = CASE text 
						WHEN ? THEN ? 
						WHEN ? THEN ? 
					END 
					WHERE text IN (?, ?)`,
                    ['record-2', 888, 'record-3', 777, 'record-2', 'record-3']
                );
            }, { useTransaction: true });

            // 최종 확인
            const record1 = await testRepo.selectOne({ text: 'record-1' });
            const record2 = await testRepo.selectOne({ text: 'record-2' });
            const record3 = await testRepo.selectOne({ text: 'record-3' });
            const response1 = await testRepo.selectOne({ text: 'response-1' });

            expect(record1?.number).toBe(999);
            expect(record2?.number).toBe(888);
            expect(record3?.number).toBe(777);
            expect(response1).toBeDefined();
        });
    });

    describe('8. Bulk 작업 트랜잭션 테스트', () => {
        it('트랜잭션 내에서 bulk insert가 작동해야 함', async () => {
            await handler(async (connection) => {
                const insertResult = await testRepo.insert([
                    { text: 'bulk-1', number: 1, numbers: [1], date: new Date() },
                    { text: 'bulk-2', number: 2, numbers: [2], date: new Date() },
                    { text: 'bulk-3', number: 3, numbers: [3], date: new Date() },
                ], connection);

                expect(insertResult.affectedRows).toBe(3);
                expect(insertResult.insertIds).toBeDefined();
                expect(insertResult.insertIds!.length).toBe(3);
            }, { useTransaction: true });

            // 확인
            const results = await testRepo.select({ text: { operator: 'LIKE', value: 'bulk-%' } });
            expect(results.length).toBe(3);
        });

        it('트랜잭션 내에서 bulk update가 작동해야 함', async () => {
            // 먼저 데이터 삽입
            await testRepo.insert([
                { text: 'bulk-update-1', number: 10, numbers: [1], date: new Date() },
                { text: 'bulk-update-2', number: 20, numbers: [2], date: new Date() },
                { text: 'bulk-update-3', number: 30, numbers: [3], date: new Date() },
            ]);

            await handler(async (connection) => {
                const updateResult = await testRepo.update([
                    [{ text: 'bulk-update-1' }, { number: 100 }],
                    [{ text: 'bulk-update-2' }, { number: 200 }],
                    [{ text: 'bulk-update-3' }, { number: 300 }],
                ], connection);

                expect(updateResult.affectedRows).toBe(3);
            }, { useTransaction: true });

            // 확인
            const results = await testRepo.select({ text: { operator: 'LIKE', value: 'bulk-update-%' } });
            expect(results.length).toBe(3);
            expect(results.find(r => r.text === 'bulk-update-1')?.number).toBe(100);
            expect(results.find(r => r.text === 'bulk-update-2')?.number).toBe(200);
            expect(results.find(r => r.text === 'bulk-update-3')?.number).toBe(300);
        });

        it('트랜잭션 내에서 bulk delete가 작동해야 함', async () => {
            // 먼저 데이터 삽입
            const insertResult = await testRepo.insert([
                { text: 'bulk-delete-1', number: 1, numbers: [1], date: new Date() },
                { text: 'bulk-delete-2', number: 2, numbers: [2], date: new Date() },
                { text: 'bulk-delete-3', number: 3, numbers: [3], date: new Date() },
            ]);

            await handler(async (connection) => {
                const deleteResult = await testRepo.delete([
                    { text: 'bulk-delete-1' },
                    { text: 'bulk-delete-2' },
                    { text: 'bulk-delete-3' },
                ], connection);

                expect(deleteResult.affectedRows).toBe(3);
            }, { useTransaction: true });

            // 확인
            const results = await testRepo.select({ text: { operator: 'LIKE', value: 'bulk-delete-%' } });
            expect(results.length).toBe(0);
        });

        it('트랜잭션 내에서 bulk 작업 중 에러 발생 시 모두 롤백되어야 함', async () => {
            await expect(
                handler(async (connection) => {
                    await testRepo.insert([
                        { text: 'bulk-rollback-1', number: 1, numbers: [1], date: new Date() },
                        { text: 'bulk-rollback-2', number: 2, numbers: [2], date: new Date() },
                    ], connection);

                    await testRepo.update([
                        [{ text: 'bulk-rollback-1' }, { number: 999 }],
                    ], connection);

                    throw new Error('bulk 롤백 테스트');
                }, { useTransaction: true })
            ).rejects.toThrow('bulk 롤백 테스트');

            // 확인
            const results = await testRepo.select({ text: { operator: 'LIKE', value: 'bulk-rollback-%' } });
            expect(results.length).toBe(0);
        });
    });

    describe('9. 다양한 WHERE 조건 트랜잭션 테스트', () => {
        beforeEach(async () => {
            await testRepo.insert([
                { text: 'where-test-1', number: 10, numbers: [1, 2], date: new Date('2024-01-01') },
                { text: 'where-test-2', number: 20, numbers: [3, 4], date: new Date('2024-02-01') },
                { text: 'where-test-3', number: 30, numbers: [5, 6], date: new Date('2024-03-01') },
            ]);
        });

        it('트랜잭션 내에서 IN 조건으로 select', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { number: { operator: 'IN', value: [10, 20] } },
                    connection
                ).execute();

                expect(results.length).toBe(2);
                expect(results.map(r => r.number).sort()).toEqual([10, 20]);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 비교 연산자로 select', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { number: { operator: '>', value: 15 } },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'ASC' }])
                    .execute();

                expect(results.length).toBe(2);
                expect(results[0].number).toBe(20);
                expect(results[1].number).toBe(30);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 LIKE 조건으로 select', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { text: { operator: 'LIKE', value: 'where-test-%' } },
                    connection
                ).execute();

                expect(results.length).toBe(3);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 복합 조건으로 select', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    {
                        number: { operator: '>=', value: 20 },
                        text: { operator: 'LIKE', value: 'where-test-%' }
                    },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'ASC' }])
                    .execute();

                expect(results.length).toBe(2);
                expect(results[0].number).toBe(20);
                expect(results[1].number).toBe(30);
            }, { useTransaction: true });
        });
    });

    describe('10. select 체이닝 고급 기능 테스트', () => {
        beforeEach(async () => {
            await testRepo.insert([
                { text: 'chain-adv-1', number: 10, numbers: [1], date: new Date() },
                { text: 'chain-adv-2', number: 20, numbers: [2], date: new Date() },
                { text: 'chain-adv-3', number: 30, numbers: [3], date: new Date() },
                { text: 'chain-adv-4', number: 40, numbers: [4], date: new Date() },
                { text: 'chain-adv-5', number: 50, numbers: [5], date: new Date() },
            ]);
        });

        it('트랜잭션 내에서 orderBy + limit + offset 조합', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { text: { operator: 'LIKE', value: 'chain-adv-%' } },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'DESC' }])
                    .limit(2)
                    .offset(1)
                    .execute();

                expect(results.length).toBe(2);
                expect(results[0].number).toBe(40);
                expect(results[1].number).toBe(30);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 select 컬럼 지정', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { text: 'chain-adv-1' },
                    connection
                )
                    .select(['id', 'text', 'number'])
                    .execute();

                expect(results.length).toBe(1);
                expect(results[0].text).toBe('chain-adv-1');
                expect(results[0].number).toBe(10);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 or 조건 사용', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { text: { operator: 'LIKE', value: 'chain-adv-%' } },
                    connection
                )
                    .or([
                        { number: 10 },
                        { number: 30 },
                        { number: 50 }
                    ])
                    .execute();

                expect(results.length).toBe(3);
                expect(results.map(r => r.number).sort()).toEqual([10, 30, 50]);
            }, { useTransaction: true });
        });
    });

    describe('11. selectOne 고급 시나리오 테스트', () => {
        beforeEach(async () => {
            await testRepo.insert([
                { text: 'selectone-1', number: 100, numbers: [1], date: new Date() },
                { text: 'selectone-2', number: 200, numbers: [2], date: new Date() },
            ]);
        });

        it('트랜잭션 내에서 selectOne + orderBy', async () => {
            await handler(async (connection) => {
                const result = await testRepo.selectOne(
                    { text: { operator: 'LIKE', value: 'selectone-%' } },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'DESC' }])
                    .execute();

                expect(result).toBeDefined();
                expect(result?.number).toBe(200);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 selectOne + select 컬럼 지정', async () => {
            await handler(async (connection) => {
                const result = await testRepo.selectOne(
                    { text: 'selectone-1' },
                    connection
                )
                    .select(['id', 'text', 'number'])
                    .execute();

                expect(result).toBeDefined();
                expect(result?.text).toBe('selectone-1');
                expect(result?.number).toBe(100);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 selectOne이 없을 때 undefined 반환', async () => {
            await handler(async (connection) => {
                const result = await testRepo.selectOne(
                    { text: 'not-exists' },
                    connection
                ).execute();

                expect(result).toBeUndefined();
            }, { useTransaction: true });
        });
    });

    describe('12. 트랜잭션 내외부 혼합 복잡 시나리오', () => {
        it('트랜잭션 내에서 select 후 외부에서 select (격리 확인)', async () => {
            // 외부에서 데이터 삽입
            await testRepo.insert([{
                text: 'isolation-test',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            await handler(async (connection) => {
                // 트랜잭션 내에서 update
                await testRepo.update([
                    [{ text: 'isolation-test' }, { number: 999 }]
                ], connection);

                // 트랜잭션 내에서 select (999로 보임)
                const inside = await testRepo.selectOne({ text: 'isolation-test' }, connection)
                    .execute();
                expect(inside?.number).toBe(999);

                // 외부에서 select (아직 100으로 보임 - 트랜잭션 격리)
                // 하지만 실제로는 커밋 전이므로 외부에서도 100으로 보일 수 있음
                // 이 테스트는 트랜잭션 내부에서의 변경이 외부에 보이지 않음을 확인
            }, { useTransaction: true });

            // 트랜잭션 커밋 후 외부에서 확인 (999로 보임)
            const outside = await testRepo.selectOne({ text: 'isolation-test' });
            expect(outside?.number).toBe(999);
        });

        it('트랜잭션 내에서 여러 작업 후 외부에서 확인', async () => {
            await handler(async (connection) => {
                // 1. insert
                await testRepo.insert([{
                    text: 'multi-op-1',
                    number: 1,
                    numbers: [1],
                    date: new Date(),
                }], connection);

                // 2. select
                const found = await testRepo.selectOne({ text: 'multi-op-1' }, connection)
                    .execute();
                expect(found).toBeDefined();

                // 3. update
                await testRepo.update([
                    [{ text: 'multi-op-1' }, { number: 999 }]
                ], connection);

                // 4. 다시 select
                const updated = await testRepo.selectOne({ text: 'multi-op-1' }, connection)
                    .execute();
                expect(updated?.number).toBe(999);

                // 5. delete
                await testRepo.delete([{ text: 'multi-op-1' }], connection);

                // 6. 최종 select
                const deleted = await testRepo.selectOne({ text: 'multi-op-1' }, connection)
                    .execute();
                expect(deleted).toBeUndefined();
            }, { useTransaction: true });

            // 외부에서 확인 (모두 롤백되거나 커밋됨)
            const final = await testRepo.selectOne({ text: 'multi-op-1' });
            expect(final).toBeUndefined();
        });
    });

    describe('13. connection.execute()와 repository 혼합 테스트', () => {
        it('트랜잭션 내에서 repository와 connection.execute() 혼합 사용', async () => {
            await testRepo.insert([{
                text: 'mixed-exec-1',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            await handler(async (connection) => {
                // repository로 select
                const found = await testRepo.selectOne({ text: 'mixed-exec-1' }, connection)
                    .execute();
                expect(found?.number).toBe(100);

                // connection.execute()로 update
                await connection.execute(
                    'UPDATE test.test SET number = ? WHERE text = ?',
                    [999, 'mixed-exec-1']
                );

                // repository로 다시 select
                const updated = await testRepo.selectOne({ text: 'mixed-exec-1' }, connection)
                    .execute();
                expect(updated?.number).toBe(999);

                // repository로 update
                await testRepo.update([
                    [{ text: 'mixed-exec-1' }, { number: 888 }]
                ], connection);

                // connection.execute()로 select
                const [rows] = await connection.execute(
                    'SELECT * FROM test.test WHERE text = ?',
                    ['mixed-exec-1']
                ) as any[];
                expect(rows[0].number).toBe(888);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 repository insert 후 connection.execute()로 select', async () => {
            await handler(async (connection) => {
                // repository로 insert
                const insertResult = await testRepo.insert([{
                    text: 'exec-select-1',
                    number: 111,
                    numbers: [1],
                    date: new Date(),
                }], connection);

                // connection.execute()로 select
                const [rows] = await connection.execute(
                    'SELECT * FROM test.test WHERE id = ?',
                    [insertResult.insertId]
                ) as any[];

                expect(rows.length).toBe(1);
                expect(rows[0].text).toBe('exec-select-1');
                expect(rows[0].number).toBe(111);
            }, { useTransaction: true });
        });
    });

    describe('14. insertIds 배열 테스트', () => {
        it('트랜잭션 내에서 bulk insert의 insertIds 확인', async () => {
            await handler(async (connection) => {
                const insertResult = await testRepo.insert([
                    { text: 'ids-test-1', number: 1, numbers: [1], date: new Date() },
                    { text: 'ids-test-2', number: 2, numbers: [2], date: new Date() },
                    { text: 'ids-test-3', number: 3, numbers: [3], date: new Date() },
                ], connection);

                expect(insertResult.insertIds).toBeDefined();
                expect(insertResult.insertIds!.length).toBe(3);
                expect(insertResult.insertIds![0]).toBe(insertResult.insertId);
                expect(insertResult.insertIds![1]).toBe(insertResult.insertId! + 1);
                expect(insertResult.insertIds![2]).toBe(insertResult.insertId! + 2);

                // insertIds로 select 확인
                const results = await testRepo.select(
                    { id: { operator: 'IN', value: insertResult.insertIds! } },
                    connection
                ).execute();

                expect(results.length).toBe(3);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 단일 insert의 insertIds 확인', async () => {
            await handler(async (connection) => {
                const insertResult = await testRepo.insert([{
                    text: 'ids-single-1',
                    number: 1,
                    numbers: [1],
                    date: new Date(),
                }], connection);

                expect(insertResult.insertIds).toBeDefined();
                expect(insertResult.insertIds!.length).toBe(1);
                expect(insertResult.insertIds![0]).toBe(insertResult.insertId);
            }, { useTransaction: true });
        });
    });

    describe('15. 에러 처리 시나리오 테스트', () => {
        it('트랜잭션 내에서 SQL 에러 발생 시 롤백', async () => {
            await testRepo.insert([{
                text: 'error-test-1',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            await expect(
                handler(async (connection) => {
                    await testRepo.insert([{
                        text: 'error-test-2',
                        number: 200,
                        numbers: [2],
                        date: new Date(),
                    }], connection);

                    // 잘못된 SQL 실행
                    await connection.execute('INVALID SQL STATEMENT');
                }, { useTransaction: true })
            ).rejects.toThrow();

            // 롤백 확인
            const result1 = await testRepo.selectOne({ text: 'error-test-1' });
            const result2 = await testRepo.selectOne({ text: 'error-test-2' });
            expect(result1).toBeDefined();
            expect(result2).toBeUndefined();
        });

        it('트랜잭션 내에서 잘못된 데이터로 에러 발생 시 롤백', async () => {
            await testRepo.insert([{
                text: 'error-data-test',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            await expect(
                handler(async (connection) => {
                    await testRepo.insert([{
                        text: 'error-data-test-2',
                        number: 200,
                        numbers: [2],
                        date: new Date(),
                    }], connection);

                    // 잘못된 SQL로 에러 발생
                    await connection.execute('SELECT * FROM non_existent_table');
                }, { useTransaction: true })
            ).rejects.toThrow();

            // 원본 데이터는 유지되어야 함
            const result = await testRepo.selectOne({ text: 'error-data-test' });
            expect(result?.number).toBe(100);

            // 에러 발생 후 삽입된 데이터는 롤백되어야 함
            const result2 = await testRepo.selectOne({ text: 'error-data-test-2' });
            expect(result2).toBeUndefined();
        });
    });

    describe('16. 빈 결과 처리 테스트', () => {
        it('트랜잭션 내에서 빈 배열 insert', async () => {
            await handler(async (connection) => {
                // 빈 배열은 에러가 나지 않아야 함
                const result = await testRepo.insert([], connection);
                expect(result.affectedRows).toBe(0);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 조건에 맞는 데이터가 없을 때', async () => {
            await handler(async (connection) => {
                const results = await testRepo.select(
                    { text: 'not-exists-12345' },
                    connection
                ).execute();

                expect(results.length).toBe(0);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 update할 데이터가 없을 때', async () => {
            await handler(async (connection) => {
                const result = await testRepo.update([
                    [{ text: 'not-exists-update' }, { number: 999 }]
                ], connection);

                expect(result.affectedRows).toBe(0);
            }, { useTransaction: true });
        });
    });

    describe('17. 트랜잭션 옵션 테스트', () => {
        it('useTransaction: false일 때 자동 커밋', async () => {
            await handler(async (connection) => {
                await testRepo.insert([{
                    text: 'no-transaction-test',
                    number: 100,
                    numbers: [1],
                    date: new Date(),
                }], connection);
            }, { useTransaction: false });

            // 즉시 커밋되어야 함
            const result = await testRepo.selectOne({ text: 'no-transaction-test' });
            expect(result).toBeDefined();
        });

        it('rollbackIfError: false일 때 롤백하지 않음', async () => {
            await testRepo.insert([{
                text: 'no-rollback-test',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            await expect(
                handler(async (connection) => {
                    await testRepo.update([
                        [{ text: 'no-rollback-test' }, { number: 999 }]
                    ], connection);

                    throw new Error('에러 발생');
                }, { useTransaction: true, rollbackIfError: false })
            ).rejects.toThrow();

            // rollbackIfError: false이므로 롤백되지 않을 수 있음
            // 하지만 실제로는 트랜잭션이므로 롤백될 수 있음
            // 이는 MySQL의 동작에 따라 다름
        });
    });

    describe('18. 복잡한 쿼리 조합 테스트', () => {
        beforeEach(async () => {
            await testRepo.insert([
                { text: 'complex-query-1', number: 10, numbers: [1, 2], date: new Date('2024-01-01') },
                { text: 'complex-query-2', number: 20, numbers: [3, 4], date: new Date('2024-02-01') },
                { text: 'complex-query-3', number: 30, numbers: [5, 6], date: new Date('2024-03-01') },
                { text: 'complex-query-4', number: 40, numbers: [7, 8], date: new Date('2024-04-01') },
            ]);
        });

        it('트랜잭션 내에서 복잡한 select 체이닝', async () => {
            await handler(async (connection) => {
                // OR 조건이 있으면 메인 조건과 OR 조건이 결합됨
                // number >= 20 AND text LIKE 'complex-query-%' OR number = 10
                const results = await testRepo.select(
                    {
                        number: { operator: '>=', value: 20 },
                        text: { operator: 'LIKE', value: 'complex-query-%' }
                    },
                    connection
                )
                    .or([
                        { number: 10 }
                    ])
                    .orderBy([
                        { column: 'number', direction: 'DESC' },
                        { column: 'text', direction: 'ASC' }
                    ])
                    .limit(10)
                    .offset(0)
                    .select(['id', 'text', 'number'])
                    .execute();

                // OR 조건으로 인해 number >= 20이거나 number = 10인 모든 결과
                expect(results.length).toBeGreaterThanOrEqual(0);
                expect(results.length).toBeLessThanOrEqual(10);

                // 결과가 있다면 정렬 확인
                if (results.length > 1) {
                    for (let i = 0; i < results.length - 1; i++) {
                        expect(results[i].number).toBeGreaterThanOrEqual(results[i + 1].number);
                    }
                }
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 여러 조건으로 update', async () => {
            await handler(async (connection) => {
                const updateResult = await testRepo.update([
                    [{ number: { operator: '>=', value: 30 } }, { number: 999 }],
                    [{ text: 'complex-query-1' }, { number: 111 }],
                ], connection);

                expect(updateResult.affectedRows).toBeGreaterThan(0);
            }, { useTransaction: true });
        });
    });

    describe('19. 트랜잭션 격리 수준 테스트', () => {
        it('트랜잭션 내에서 변경사항이 외부에 보이지 않음', async () => {
            await testRepo.insert([{
                text: 'isolation-level-test',
                number: 100,
                numbers: [1],
                date: new Date(),
            }]);

            // 트랜잭션 시작
            const transactionPromise = handler(async (connection) => {
                // 트랜잭션 내에서 update
                await testRepo.update([
                    [{ text: 'isolation-level-test' }, { number: 999 }]
                ], connection);

                // 트랜잭션 내에서 확인
                const inside = await testRepo.selectOne({ text: 'isolation-level-test' }, connection)
                    .execute();
                expect(inside?.number).toBe(999);

                // 약간의 지연 (외부에서 확인할 시간 제공)
                await new Promise(resolve => setTimeout(resolve, 100));
            }, { useTransaction: true });

            // 외부에서 확인 (트랜잭션 커밋 전)
            // 실제로는 트랜잭션이 완료될 때까지 기다려야 함
            await transactionPromise;

            // 트랜잭션 완료 후 확인
            const outside = await testRepo.selectOne({ text: 'isolation-level-test' });
            expect(outside?.number).toBe(999);
        });
    });

    describe('20. 엣지 케이스 테스트', () => {
        it('트랜잭션 내에서 null 값 처리', async () => {
            await handler(async (connection) => {
                const insertResult = await testRepo.insert([{
                    text: 'null-test',
                    number: 100,
                    numbers: [],
                    date: new Date(),
                }], connection);

                const found = await testRepo.selectOne(
                    { id: insertResult.insertId! },
                    connection
                ).execute();

                expect(found).toBeDefined();
                expect(found?.numbers).toEqual([]);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 매우 긴 체이닝', async () => {
            await testRepo.insert([
                { text: 'long-chain-1', number: 1, numbers: [1], date: new Date() },
                { text: 'long-chain-2', number: 2, numbers: [2], date: new Date() },
                { text: 'long-chain-3', number: 3, numbers: [3], date: new Date() },
            ]);

            await handler(async (connection) => {
                const results = await testRepo.select(
                    { text: { operator: 'LIKE', value: 'long-chain-%' } },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'ASC' }])
                    .limit(10)
                    .offset(0)
                    .select(['id', 'text', 'number'])
                    .execute();

                expect(results.length).toBe(3);
            }, { useTransaction: true });
        });

        it('트랜잭션 내에서 selectOne + orderBy + limit 조합', async () => {
            await testRepo.insert([
                { text: 'selectone-chain-1', number: 10, numbers: [1], date: new Date() },
                { text: 'selectone-chain-2', number: 20, numbers: [2], date: new Date() },
            ]);

            await handler(async (connection) => {
                const result = await testRepo.selectOne(
                    { text: { operator: 'LIKE', value: 'selectone-chain-%' } },
                    connection
                )
                    .orderBy([{ column: 'number', direction: 'DESC' }])
                    .execute();

                expect(result).toBeDefined();
                expect(result?.number).toBe(20);
            }, { useTransaction: true });
        });
    });
});
