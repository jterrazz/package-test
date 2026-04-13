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
            // Sequential: compose mode can't isolate per-worker
            fileParallelism: false,
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
