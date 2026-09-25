import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';

import {
    api,
    cli,
    component,
    defineSpecConfig,
    integration,
    job,
    literate,
    mobile,
    unit,
    website,
} from './src/runner/index.js';

/**
 * The package eats its own preset: `defineSpecConfig()` sets the artefact
 * paths, the budgets and the `fixtures/` exclusion, and every project below
 * states only what makes it different. Every facet the package specifies
 * itself on comes from its own helper — the canonical name, include and group
 * order are the framework's, so `--project api` means the same thing here as
 * in every consumer.
 */
const config = defineSpecConfig({
    test: {
        projects: [
            // The module tests, plus the one specs tree that is not a facet's:
            // `specs/lint/` E2E-lints fixture projects through the real oxlint
            // Binary, so it needs `npm run build` (dist/oxlint.js) and it runs
            // Where the modules run. `unit()`'s include and exclude guard each
            // Other, so stating one states both.
            // A lint rule's documents (`specs/lint/<rule>/<case>.spec.yaml`) are
            // Collected here too, bound to the one runner whose normalised
            // Report they golden.
            {
                ...unit({
                    exclude: [],
                    include: ['src/**/*.test.ts', 'lint/**/*.test.ts', 'specs/lint/**/*.test.ts'],
                }),
                plugins: [
                    literate({
                        include: ['specs/lint/*/*.spec.yaml'],
                        specification: './specs/lint/report.specification.ts',
                    }),
                ],
            },
            // The cli helper wires the literate door: the package's documents
            // Are collected as TEST FILES by the project that owns the facet.
            // The glob stops at depth 1 so the deliberately-wrong twins under
            // `run/fixtures/` stay inputs to the negative specs.
            cli({
                literate: {
                    include: ['specs/cli/run/*.spec.yaml'],
                    specification: './specs/cli/literate-cli.specification.ts',
                },
            }),
            // Parallel: the run's containers are shared, and each worker gets a
            // Database of its own and a Redis index.
            api(),
            job(),
            // Serial: the facet's own probes of the container seams start
            // Their own infrastructure — a compose stack among them — and a
            // Docker daemon is the one thing every file of this project
            // Shares. Run in parallel they starve each other's healthchecks.
            integration({ serial: true }),
            // Needs playwright + `npx playwright install chromium`; no Docker.
            website(),
            // Serial by default, one driver session per run. The protocol
            // Double is served once for the run too, its setup placed first
            // So it still answers when `mobile()`'s own ends the session.
            mergeConfig(
                {
                    test: {
                        globalSetup: [
                            resolve(
                                import.meta.dirname,
                                'specs/shared/fixtures/appium-double/per-run.ts',
                            ),
                        ],
                    },
                },
                mobile(),
            ),
            component({
                // Every render's context, stated away from every default so the
                // Component app proves each one reaches the page: `clock/`,
                // `locale/`, `timezone/` and `viewport/` each read theirs.
                clock: '2026-01-02T03:04:05.000Z',
                // The package's own component app is the subject its component
                // Specs stand on, and A2's law holds for it too: the test of a
                // Component is the `.test.tsx` NEXT to it.
                include: ['specs/component/**/*.test.tsx'],
                locale: 'fr-FR',
                // `wrap` is read against the app's folder, not the config's.
                root: resolve(import.meta.dirname, 'specs/component'),
                timezone: 'Europe/Paris',
                viewport: { height: 640, width: 1024 },
                vite: {
                    // The app's routing is the one dependency its components
                    // Import that the seam does not pre-bundle for them.
                    optimizeDeps: { include: ['react-router'] },
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
                wrap: './wrap/providers.tsx',
            }),
        ],
    },
});

/**
 * Coverage counts the checker's child processes too. The documents and the
 * checker tests run `dist/checker.js` as a child, so v8 hands every child the
 * `NODE_V8_COVERAGE` directory it merges from (`autoAttachSubprocess`); the
 * build's source maps take each bundle back to the `lint/` and `src/` modules
 * it was built from. `dist/` is read, then judged AFTER that remap
 * (`excludeAfterRemap`), so what counts is the source the bundle ran.
 */
const coverage = config.test?.coverage;
if (coverage?.provider === 'v8') {
    coverage.autoAttachSubprocess = true;
    coverage.excludeAfterRemap = true;
    coverage.exclude = (coverage.exclude ?? []).filter((glob) => glob !== 'dist/**');
}

export default config;
