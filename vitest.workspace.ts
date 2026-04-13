import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
    {
        test: {
            name: 'fast',
            include: ['src/**/*.test.ts', 'tests/cli/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'http-app',
            fileParallelism: false,
            include: ['tests/http/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'http-stack',
            fileParallelism: false,
            include: ['tests/http/**/*.test.ts'],
            env: { SPEC_RUNNER: 'stack' },
        },
    },
    {
        test: {
            name: 'adapters',
            fileParallelism: false,
            include: ['tests/adapters/**/*.test.ts'],
        },
    },
]);
