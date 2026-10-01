import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { VITEST_ARTIFACTS_DIR } from '../lint/engine/project/artifacts.js';
import { defineSpecConfig } from './index.vitest.js';

const ROOT = resolve(import.meta.dirname, '..');

type ProjectHelper = () => { test?: { globalSetup?: string | string[] } };

describe('index.vitest', () => {
    test('@jterrazz/test/vitest — a built project names setups the bundle ships — every global setup a built project helper names is a file of dist/', async () => {
        // Given - the built runner-config entry, whose helpers resolve their setups beside the bundle (`npm run build` first)
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a computed specifier resolves to `any`: the helpers are what this reads of it
        const built = (await import(resolve(ROOT, 'dist/vitest.js'))) as Record<string, unknown>;
        const helpers = ['api', 'integration', 'job', 'mobile', 'unit'] as const;

        // When - each helper builds its project, as a consumer's config calls it
        const setups = helpers.flatMap((name) => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a computed entry is `any`: this is the helper shape the config calls
            const project = (built[name] as ProjectHelper)();
            return [project.test?.globalSetup ?? []].flat();
        });

        // Then - each names its entry in dist/, and the file is there: a renamed entry would fail every consumer's run at startup
        const named = [...new Set(setups.map((setup) => relative(ROOT, setup)))].toSorted();
        expect(named).toStrictEqual([
            'dist/in-place-setup.js',
            'dist/mobile-session.js',
            'dist/route-coverage.js',
            'dist/services-setup.js',
            'dist/temp-root.js',
        ]);
        expect(named.filter((setup) => !existsSync(resolve(ROOT, setup)))).toStrictEqual([]);
    });

    test('defineSpecConfig() — the literate plugin — registers the plugin when a specification is given', () => {
        // Given - a config naming the runner its spec documents run through
        const config = defineSpecConfig({
            literate: { specification: './specs/cli/cli.specification.ts' },
        });

        // Then - the plugin is in place, and `literate` never leaks as a vite key
        expect(config.plugins).toHaveLength(1);
        expect(config.plugins?.[0]).toMatchObject({ name: 'jterrazz-test:literate' });
        expect(config).not.toHaveProperty('literate');
    });

    test('defineSpecConfig() — the literate plugin — leaves plugins alone when no specification is given', () => {
        // Given - a plain config
        const config = defineSpecConfig({ test: { include: ['src/**'] } });

        // Then - no plugin was invented
        expect(config.plugins).toBeUndefined();
    });

    test('defineSpecConfig() — the preset — projects keep their defaults beside a literate config', () => {
        // Given - a literate config that also states its projects
        const config = defineSpecConfig({
            literate: { specification: './specs/cli/cli.specification.ts' },
            test: { projects: [{ test: { name: 'stated' } }] },
        });

        // Then - the stated project still receives the project defaults
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({
            cacheDir: VITEST_ARTIFACTS_DIR,
            test: { name: 'stated', testTimeout: 30_000 },
        });
        expect(config.plugins).toHaveLength(1);
    });
});
