import { describe, expect, test } from 'vitest';

import {
    ATTACHMENTS_DIR,
    COVERAGE_DIR,
    REPORTER_OUTPUT_FILES,
    VITEST_ARTIFACTS_DIR,
} from '../specification/artifacts/artifacts.js';
import { defineSpecConfig } from './preset.js';

describe('defineSpecConfig() — artefact paths', () => {
    test('sends the vite cache and the coverage report under .artifacts/vitest', () => {
        // Given - the preset alone, nothing stated
        const config = defineSpecConfig();

        // Then - both writers point inside the one artefact folder
        expect(config.cacheDir).toBe(VITEST_ARTIFACTS_DIR);
        expect(config.test?.coverage).toStrictEqual({ reportsDirectory: COVERAGE_DIR });
    });

    test('routes every path Vitest 5 pins under .artifacts/vitest', () => {
        // Given - the preset alone: the attachments a test annotates, the failure screenshots, and the four reporters that became file writers
        const config = defineSpecConfig();

        // Then - none of them lands on `.vitest/` at the repository root, which is the one folder the estate's artefact rule does not cover
        expect(config.test?.attachmentsDir).toBe(ATTACHMENTS_DIR);
        expect(config.test?.outputFile).toStrictEqual(REPORTER_OUTPUT_FILES);
        expect(
            Object.values(REPORTER_OUTPUT_FILES).every((path) =>
                path.startsWith(VITEST_ARTIFACTS_DIR),
            ),
        ).toBe(true);
    });

    test('gives a project the attachments directory too', () => {
        // Given - a config with one inline project
        const config = defineSpecConfig({
            test: { projects: [{ test: { include: ['src/a.test.ts'], name: 'unit' } }] },
        });

        // Then - the project carries it on its own: a project inherits nothing from the root
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({ test: { attachmentsDir: ATTACHMENTS_DIR } });
    });

    test('gives every inline project the cache dir too', () => {
        // Given - a config with projects (each is resolved as its own vite config, inheriting nothing from the root)
        const config = defineSpecConfig({
            test: { projects: [{ test: { include: ['src/a.test.ts'], name: 'unit' } }] },
        });

        // Then - the project carries the artefact cache dir on its own
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({ cacheDir: VITEST_ARTIFACTS_DIR });
    });
});

describe('defineSpecConfig() — defaults', () => {
    test('raises the test and hook budgets to 30s', () => {
        // Given - the preset alone
        const config = defineSpecConfig();

        // Then - vitest's 5s/10s defaults are replaced by the ecosystem's
        expect(config.test?.testTimeout).toBe(30_000);
        expect(config.test?.hookTimeout).toBe(30_000);
    });

    test('excludes what a spec stands on — `_fixtures/` is an input, not a suite', () => {
        // Given - the preset alone
        const config = defineSpecConfig();

        // Then - the underscored ground never gets collected
        expect(config.test?.exclude).toContain('**/_fixtures/**');
        expect(config.test?.exclude).toContain('**/node_modules/**');
    });

    test('carries the same budgets and exclusions into a project', () => {
        // Given - a project that states only its own include
        const config = defineSpecConfig({
            test: { projects: [{ test: { include: ['src/a.test.ts'], name: 'unit' } }] },
        });

        // Then - the project got the defaults, not vitest's
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({
            test: { hookTimeout: 30_000, testTimeout: 30_000 },
        });
        expect((project as { test: { exclude: string[] } }).test.exclude).toContain(
            '**/_fixtures/**',
        );
    });
});

describe('defineSpecConfig() — what the consumer states wins', () => {
    test('a stated timeout replaces the default instead of adding to it', () => {
        // Given - a config raising the budget for a slow simulator suite
        const config = defineSpecConfig({ test: { testTimeout: 240_000 } });

        // Then - the stated value is the one vitest sees
        expect(config.test?.testTimeout).toBe(240_000);
    });

    test('a stated exclude ADDS to the preset list rather than replacing it', () => {
        // Given - a config excluding one heavy spec
        const config = defineSpecConfig({ test: { exclude: ['specs/smoke/**'] } });

        // Then - vite concatenates: the preset's exclusions survive, so a consumer never has to spread `configDefaults.exclude` by hand
        expect(config.test?.exclude).toContain('specs/smoke/**');
        expect(config.test?.exclude).toContain('**/_fixtures/**');
    });

    test('a project overrides the preset per project', () => {
        // Given - one sequential project among defaults
        const config = defineSpecConfig({
            test: {
                projects: [
                    { test: { fileParallelism: false, name: 'integrations', testTimeout: 60_000 } },
                ],
            },
        });

        // Then - its own values win, and the rest of the preset stays
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({
            cacheDir: VITEST_ARTIFACTS_DIR,
            test: { fileParallelism: false, hookTimeout: 30_000, testTimeout: 60_000 },
        });
    });

    test('a project declared as a glob string is handed back untouched', () => {
        // Given - vitest's other project form: a path glob
        const config = defineSpecConfig({ test: { projects: ['packages/*'] } });

        // Then - there is no object to merge into, so nothing is invented
        expect(config.test?.projects).toStrictEqual(['packages/*']);
    });
});

describe('defineSpecConfig() — the hygiene a suite does not have to write', () => {
    test('never retries: a flaky test is fixed or deleted', () => {
        // Given - the preset alone
        const config = defineSpecConfig();

        // Then - the policy is the default, so no repository has to state it
        expect(config.test?.retry).toBe(0);
    });

    test('gives back what a test took — the spies, the globals, the environment', () => {
        // Given - the preset alone
        const config = defineSpecConfig();

        // Then - the three restores are on, which is what lets `clock.at()` and `vi.stubEnv()` be written with no teardown hook (J6w)
        expect(config.test?.restoreMocks).toBe(true);
        expect(config.test?.unstubGlobals).toBe(true);
        expect(config.test?.unstubEnvs).toBe(true);
    });

    test('carries the same hygiene into a project', () => {
        // Given - a project that states only its own include
        const config = defineSpecConfig({
            test: { projects: [{ test: { include: ['src/a.test.ts'], name: 'unit' } }] },
        });

        // Then - a project resolves as its own config, so the defaults are merged into it
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({
            test: { restoreMocks: true, retry: 0, unstubEnvs: true, unstubGlobals: true },
        });
    });

    test('what a config states wins over all of it', () => {
        // Given - a repository whose subject IS the retry
        const config = defineSpecConfig({ test: { retry: 2 } });

        // Then - the preset is a default, not a ceiling
        expect(config.test?.retry).toBe(2);
    });
});

describe('defineSpecConfig() — the literate plugin', () => {
    test('registers the plugin when a specification is given', () => {
        // Given - a config naming the runner its spec documents run through
        const config = defineSpecConfig({
            literate: { specification: './specs/cli/cli.specification.ts' },
        });

        // Then - the plugin is in place, and `literate` never leaks as a vite key
        expect(config.plugins).toHaveLength(1);
        expect(config.plugins?.[0]).toMatchObject({ name: 'jterrazz-test:literate' });
        expect(config).not.toHaveProperty('literate');
    });

    test('leaves plugins alone when no specification is given', () => {
        // Given - a plain config
        const config = defineSpecConfig({ test: { include: ['src/**'] } });

        // Then - no plugin was invented
        expect(config.plugins).toBeUndefined();
    });
});
