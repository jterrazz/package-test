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
            name: 'infra',
            fileParallelism: false,
            include: ['tests/http/**/*.test.ts', 'tests/integration/**/*.test.ts'],
        },
    },
]);
