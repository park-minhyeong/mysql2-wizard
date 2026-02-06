// 테스트 환경 설정
// dotenv를 사용하여 환경 변수 로드
import dotenv from 'dotenv';
import { beforeAll, afterEach } from 'vitest';

// .env 파일 로드
dotenv.config();

// 테스트 전 글로벌 설정
beforeAll(() => {
    // 테스트 환경 변수 확인
    if (!process.env.DB_HOST) {
        console.warn('⚠️  DB 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
    }
});

// 각 테스트 후 정리
afterEach(() => {
    // 필요시 추가 정리 작업
});
