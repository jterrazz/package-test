import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'fast',
                    // Specs/lint E2E-lints fixture projects through the real
                    // Oxlint binary — needs `npm run build` (dist/oxlint.js).
                    include: [
                        'src/**/*.test.ts',
                        'specs/cli/**/*.test.ts',
                        'specs/lint/**/*.test.ts',
                    ],
                },
            },
            {
                test: {
                    name: 'api',
                    // Parallel: each worker gets isolated DB schema + Redis DB via IsolationStrategy
                    include: ['specs/api/**/*.test.ts', 'specs/jobs/**/*.test.ts'],
                },
            },
            {
                test: {
                    name: 'api-stack',
                    // Parallel: each worker gets its own compose project (test-worker-N)
                    include: ['specs/api/**/*.test.ts', 'specs/jobs/**/*.test.ts'],
                    // Intercepts are in-process (MSW) — node-only (CONVENTIONS I3/D7)
                    exclude: [...configDefaults.exclude, 'specs/api/intercepts/**'],
                    env: { TEST_MODE: 'compose' },
                },
            },
            {
                test: {
                    name: 'integrations',
                    // Sequential: tests container lifecycle (start/stop) — inherently serial
                    fileParallelism: false,
                    include: ['specs/integrations/**/*.test.ts'],
                },
            },
        ],
    },
});
