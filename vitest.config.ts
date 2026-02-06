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
