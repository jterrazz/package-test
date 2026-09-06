import { configDefaults, defineConfig } from 'vitest/config';

import { literate } from './src/vitest/index.js';

export default defineConfig({
    test: {
        projects: [
            {
                // The framework eats its own literate format: `specs/cli/literate/*.cli`
                // Are collected as TEST FILES and run through the registered runner.
                // The glob stops at depth 1 so the deliberately-broken twins under
                // `literate/fixtures/` stay inputs to the negative specs, never tests.
                plugins: [
                    literate({
                        include: ['specs/cli/literate/*.cli'],
                        specification: './specs/cli/literate-cli.specification.ts',
                    }),
                ],
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
                    name: 'website',
                    // Needs playwright + `npx playwright install chromium`; no Docker.
                    include: ['specs/website/**/*.test.ts'],
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
