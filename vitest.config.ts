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
} from './src/runner/index.js';

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
            // Serial: the facet's own probes of the container seams start
            // Their own infrastructure — a compose stack among them — and a
            // Docker daemon is the one thing every file of this project
            // Shares. Run in parallel they starve each other's healthchecks.
            integration({ serial: true }),
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
