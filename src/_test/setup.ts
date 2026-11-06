// 테스트 환경 설정: .env 로드 (통합 테스트용 DB 접속 정보)
import dotenv from 'dotenv';
import { beforeAll } from 'vitest';

dotenv.config();

beforeAll(() => {
    // 단위 테스트(src/_test/unit)는 DB가 필요 없으므로 경고는 통합 테스트에서만 의미가 있다
    if (!process.env.DB_HOST && !process.env.DB_URL) {
        console.warn('⚠️  DB 환경 변수가 설정되지 않았습니다. 통합 테스트는 .env 파일이 필요합니다.');
    }
});
