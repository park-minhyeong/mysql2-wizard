import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/_test/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        setupFiles: ['src/_test/setup.ts'],
        testTimeout: 30000, // DB 연결을 위한 타임아웃 증가
        // 통합 테스트 파일들이 같은 test.test 테이블을 beforeEach에서 비우므로 파일 단위 병렬 실행 시 서로 간섭한다
        fileParallelism: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/_test/',
                '**/*.d.ts',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
