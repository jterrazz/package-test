import { defineSpecConfig, literate } from './src/vitest/index.js';

/**
 * The package eats its own preset: `defineSpecConfig()` sets the artefact
 * paths, the budgets and the `_fixtures/` exclusion, and every project below
 * states only what makes it different.
 */
export default defineSpecConfig({
    test: {
        projects: [
            {
                // The framework eats its own document format:
                // `specs/cli/literate/*.spec.yaml` are collected as TEST FILES and run
                // Through the registered runner. The glob stops at depth 1 so the
                // Deliberately-wrong twins under `literate/_fixtures/` stay inputs to
                // The negative specs, never tests.
                //
                // The plugin sits in THIS project, not at the root: its glob has
                // To join the include of the project that collects those documents.
                plugins: [
                    literate({
                        include: ['specs/cli/literate/*.spec.yaml'],
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
                    // Intercepts are in-process (MSW) — node-only (CONVENTIONS I3/D7).
                    // Added to the preset's list, not replacing it: vite concatenates.
                    exclude: ['specs/api/intercepts/**'],
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
