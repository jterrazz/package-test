import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { VITEST_ARTIFACTS_DIR } from '../lint/engine/project/artifacts.js';
import { GROUND_GLOB } from '../lint/engine/project/ground.js';
import { api, cli, defineSpecConfig, integration, job, mobile } from './index.vitest.js';
import { servicesSetup } from './world/services/containers/run-setup.js';

const ROOT = resolve(import.meta.dirname, '..');

function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

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

    test('the node facet helpers — one canonical project per kind — each collects its own facet tree, under its own name', () => {
        // Given - the canonical projects, stated by nobody
        // Then - `--project api` means the same tree in every repository
        expect(
            [api(), job(), integration(), mobile()].map((project) => testOf(project).name),
        ).toStrictEqual(['api', 'job', 'integration', 'mobile']);
        expect(testOf(api()).include).toStrictEqual(['specs/api/**/*.spec.ts']);
        expect(testOf(integration()).include).toStrictEqual(['specs/integration/**/*.spec.ts']);
    });

    test('the node facet helpers — one canonical project per kind — the facets that declare services carry the setup that starts them once per project', () => {
        // Given - the global setups of the three facets whose specs declare containers
        const setups = [api(), job(), integration()].map((project) => testOf(project).globalSetup);

        // Then - each serves the project's containers, which a file without it starts per specification
        for (const carried of setups) {
            expect(carried).toContain(servicesSetup());
        }
        expect(servicesSetup()).toMatch(/run-setup\.ts$/u);
    });

    test('the node facet helpers — one canonical project per kind — node facets run first, and the simulator runs alone at the end', () => {
        // Given - the group order each helper states
        const orders = [api(), job(), integration(), cli(), mobile()].map(
            (project) => testOf(project).sequence?.groupOrder,
        );

        // Then - everything node shares group 0; website is 1, component 2, and a simulator cannot share a machine with itself
        expect(orders).toStrictEqual([0, 0, 0, 0, 3]);
    });

    test('the node facet helpers — one canonical project per kind — takes the tree and the budget a repository states instead', () => {
        // Given - a facet whose tree and budget are not the convention's
        const stated = testOf(
            api({
                exclude: ['specs/api/slow/**'],
                include: ['suites/api/**/*.test.ts'],
                timeout: 90_000,
            }),
        );

        // Then - all three are the repository's, the name stays canonical
        expect(stated.include).toStrictEqual(['suites/api/**/*.test.ts']);
        expect(stated.exclude).toContain('specs/api/slow/**');
        expect(stated.exclude).toContain('**/{_expected,_fixtures,_requests,_seeds}/**');
        expect(stated.testTimeout).toBe(90_000);
        expect(stated.name).toBe('api');
    });

    test('the node facet helpers — one canonical project per kind — a node facet states its own serial run, the way website() does', () => {
        // Given - an integration suite whose files share one database file
        const shared = testOf(integration({ serial: true }));

        // Then - the project states it, and a silent helper states nothing
        expect(shared.fileParallelism).toBe(false);
        expect(testOf(integration()).fileParallelism).toBeUndefined();
    });

    test('the node facet helpers — one canonical project per kind — every helper takes it, not only the ones 15.2 shipped it on', () => {
        // Given - the four other helpers this release adds
        const serial = [api, job, mobile].map((helper) => testOf(helper({ serial: true })));

        // Then - `serial` is what chapter 02 says it is: every helper's
        expect(serial.map((project) => project.fileParallelism)).toStrictEqual([
            false,
            false,
            false,
        ]);
        expect(testOf(cli({ literate: false, serial: true })).fileParallelism).toBe(false);
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

    test('defineSpecConfig() — the preset — a config stating nothing receives the defaults of the preset', () => {
        // Given - the published function, called with nothing
        const config = defineSpecConfig();

        // Then - the budgets, the ground exclude and the artefact cache are the preset's
        expect(config.cacheDir).toBe(VITEST_ARTIFACTS_DIR);
        expect(config.test?.testTimeout).toBe(30_000);
        expect(config.test?.hookTimeout).toBe(30_000);
        expect(config.test?.exclude).toContain(GROUND_GLOB);
        expect(config.test?.retry).toBe(0);
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
