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
            name: 'http',
            // Parallel: each worker gets isolated DB schema + Redis DB via IsolationStrategy
            include: ['tests/http/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'http-stack',
            // Parallel: each worker gets its own compose project (test-worker-N)
            include: ['tests/http/**/*.test.ts'],
            env: { SPEC_RUNNER: 'stack' },
        },
    },
    {
        test: {
            name: 'adapters',
            // Sequential: tests container lifecycle (start/stop) — inherently serial
            fileParallelism: false,
            include: ['tests/adapters/**/*.test.ts'],
        },
    },
]);
