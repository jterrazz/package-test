import { resolve } from 'node:path';

import {
    api,
    cli,
    component,
    defineSpecConfig,
    integration,
    jobs,
    unit,
    website,
} from './src/vitest/index.js';

/**
 * The package eats its own preset: `defineSpecConfig()` sets the artefact
 * paths, the budgets and the `_fixtures/` exclusion, and every project below
 * states only what makes it different. Every facet the package specifies
 * itself on comes from its own helper — the canonical name, include and group
 * order are the framework's, so `--project api` means the same thing here as
 * in every consumer.
 */
export default defineSpecConfig({
    test: {
        projects: [
            // The module tests, plus the one specs tree that is not a facet's:
            // `specs/lint/` E2E-lints fixture projects through the real oxlint
            // Binary, so it needs `npm run build` (dist/oxlint.js) and it runs
            // Where the modules run. `unit()`'s include and exclude guard each
            // Other, so stating one states both.
            unit({
                exclude: [],
                include: ['src/**/*.test.ts', 'specs/lint/**/*.test.ts'],
            }),
            // The cli helper wires the literate door: the package's documents
            // Are collected as TEST FILES by the project that owns the facet.
            // The glob stops at depth 1 so the deliberately-wrong twins under
            // `literate/_fixtures/` stay inputs to the negative specs.
            cli({
                literate: {
                    include: ['specs/cli/literate/*.spec.yaml'],
                    specification: './specs/cli/literate-cli.specification.ts',
                },
            }),
            // Parallel: each worker gets an isolated DB schema + Redis DB.
            api(),
            jobs(),
            integration(),
            {
                test: {
                    name: 'api-stack',
                    // Parallel: each worker gets its own compose project (test-worker-N)
                    include: ['specs/api/**/*.test.ts', 'specs/jobs/**/*.test.ts'],
                    // Intercepts are in-process (MSW) — node-only (CONVENTIONS I3/D7).
                    // `.clock()` is in-process too: compose mode runs the app in
                    // Its own container, where this runner's calendar is nothing.
                    // The initiation errors are the NODE constructor's refusals,
                    // And they drive the compose ones themselves.
                    // Added to the preset's list, not replacing it: vite concatenates.
                    exclude: [
                        'specs/api/clock/**',
                        'specs/api/initiation-errors/**',
                        'specs/api/intercepts/**',
                    ],
                    env: { TEST_MODE: 'compose' },
                },
            },
            // Needs playwright + `npx playwright install chromium`; no Docker.
            website(),
            component({
                // The package's own component app is the subject its component
                // Specs stand on, and A2's law holds for it too: the test of a
                // Component is the `.test.tsx` NEXT to it.
                include: ['specs/component-app/**/*.test.tsx'],
                vite: {
                    resolve: {
                        // The dogfood imports the PUBLIC specifier, and in this
                        // Repository that specifier has to resolve to the
                        // Browser entry's source — the same module the
                        // `browser` condition publishes. `tsconfig`'s `paths`
                        // Mirrors it so the compiler agrees with the bundler.
                        alias: {
                            '@jterrazz/test': resolve(import.meta.dirname, 'src/browser/index.ts'),
                        },
                    },
                },
                wrap: './specs/component-app/providers.tsx',
            }),
        ],
    },
});
