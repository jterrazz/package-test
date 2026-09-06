import { describe, expect, test } from 'vitest';

import { COVERAGE_DIR, VITEST_ARTIFACTS_DIR } from '../core/artifacts/artifacts.js';
import { defineSpecConfig } from './preset.js';

describe('defineSpecConfig() — artefact paths', () => {
    test('sends the vite cache and the coverage report under .artifacts/vitest', () => {
        // Given - the preset alone, nothing stated
        const config = defineSpecConfig();

        // Then - both writers point inside the one artefact folder
        expect(config.cacheDir).toBe(VITEST_ARTIFACTS_DIR);
        expect(config.test?.coverage).toEqual({ reportsDirectory: COVERAGE_DIR });
    });

    test('gives every inline project the cache dir too', () => {
        // Given - a config with projects (each is resolved as its own vite config,
        // Inheriting nothing from the root)
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

        // Then - vite concatenates: the preset's exclusions survive, so a
        // Consumer never has to spread `configDefaults.exclude` by hand
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
        expect(config.test?.projects).toEqual(['packages/*']);
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
