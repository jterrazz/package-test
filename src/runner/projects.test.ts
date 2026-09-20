import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import nestedApp from './_fixtures/nested-app/vitest.config.js';
import { api, cli, component, integration, jobs, mobile, unit, website } from './projects.js';

/** The `test` block of a project, whatever the helper wrapped around it. */
function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

/** The plugins a project carries, by name — a plugin with no name is not one. */
function pluginNames(project: TestProjectInlineConfiguration): string[] {
    const plugins: unknown[] = Array.isArray(project.plugins) ? project.plugins : [];
    return plugins.flatMap((plugin) =>
        typeof plugin === 'object' && plugin !== null && 'name' in plugin
            ? [String(plugin.name)]
            : [],
    );
}

describe('unit() — module tests, and only module tests', () => {
    test('collects .test.ts outside specs/ and leaves .test.tsx to the browser', () => {
        // Given - the canonical project, stated by nobody
        const project = testOf(unit());

        // Then - a rendered thing is not a module test, and specs/ is another kind
        expect(project.include).toStrictEqual(['**/*.test.ts']);
        expect(project.exclude).toContain('**/*.test.tsx');
        expect(project.exclude).toContain('specs/**');
        expect(project.name).toBe('unit');
    });

    test('carries the preset budget, and the one a project states instead', () => {
        // Given - a project that needs longer than the shared 30s
        const stated = testOf(unit({ timeout: 60_000 }));

        // Then - the budget is the project's, the rest stays the preset's
        expect(stated.testTimeout).toBe(60_000);
        expect(testOf(unit()).testTimeout).toBe(30_000);
    });

    test('takes the globs a project states over the canonical ones', () => {
        // Given - a repository whose modules do not sit at the root
        const project = testOf(unit({ exclude: [], include: ['packages/**/*.test.ts'] }));

        // Then - what it states is what it collects
        expect(project.include).toStrictEqual(['packages/**/*.test.ts']);
    });

    test('turns the trees a repository names into the globs that collect them', () => {
        // Given - a repository whose modules live under two roots
        const project = testOf(unit({ roots: ['packages', 'apps/'] }));

        // Then - each root is a glob, and the trailing slash is not a second one
        expect(project.include).toStrictEqual(['packages/**/*.test.ts', 'apps/**/*.test.ts']);
    });

    test('runs before either browser project', () => {
        // Given - the canonical project
        // Then - node first (0), the page facets after
        expect(testOf(unit()).sequence).toStrictEqual({ groupOrder: 0 });
    });
});

describe('website() — the served product', () => {
    test('collects the website specs and opens its browser before the component one', () => {
        // Given - the canonical website project
        const project = testOf(website());

        // Then - one name, the `.spec.ts` tree, and the group between node and component
        expect(project.name).toBe('website');
        expect(project.include).toStrictEqual(['specs/website/**/*.spec.ts']);
        expect(project.sequence).toStrictEqual({ groupOrder: 1 });
    });

    test('runs its files one at a time when the served app is shared', () => {
        // Given - three website specs sharing one server and one database file
        const shared = testOf(website({ serial: true }));

        // Then - the project states it, so no consumer spreads it back over the helper
        expect(shared.fileParallelism).toBe(false);
        expect(testOf(website()).fileParallelism).toBeUndefined();
    });

    test('takes the globs and the budget a project states instead', () => {
        // Given - a repository whose pages are specified elsewhere, and slowly
        const project = testOf(website({ include: ['e2e/**/*.test.ts'], timeout: 60_000 }));

        // Then - what it states is what it collects, and how long it gets
        expect(project.include).toStrictEqual(['e2e/**/*.test.ts']);
        expect(project.testTimeout).toBe(60_000);
    });
});

describe('component() — the browser project', () => {
    test('runs headless chromium, and last of the groups', async () => {
        // Given - the canonical browser project
        const project = testOf(await component());

        // Then - one browser, no window, and a group of its own after website's
        expect(project.browser?.enabled).toBeTruthy();
        expect(project.browser?.headless).toBeTruthy();
        expect(project.browser?.instances).toStrictEqual([{ browser: 'chromium' }]);
        expect(project.sequence).toStrictEqual({ groupOrder: 2 });
    });

    test('keeps what Browser Mode leaks under the artefact folder', async () => {
        // Given - the canonical browser project
        const project = testOf(await component());

        // Then - neither screenshots nor attachments land on the row
        expect(project.browser?.screenshotDirectory).toBe('.artifacts/vitest/screenshots');
        expect(project.attachmentsDir).toBe('.artifacts/vitest/attachments');
    });

    test('registers the golden pair, the ARIA producer and the printer as server commands', async () => {
        // Given - the project's browser block
        const project = testOf(await component());

        // Then - the four things a page cannot do for itself are reachable from it
        expect(Object.keys(project.browser?.commands ?? {}).toSorted()).toStrictEqual([
            'ariaTree',
            'goldenRead',
            'goldenWrite',
            'notify',
        ]);
    });

    test('pre-bundles the seam so a cold cache never reloads the tester mid-run', async () => {
        // Given - the canonical browser project on this install
        const project = await component();

        // Then - react and the react adapter are declared up front
        expect(project.optimizeDeps?.include).toContain('vitest-browser-react');
        expect(project.optimizeDeps?.include).toContain('react-dom/client');
    });

    test('leaves msw to the runner, which already excludes it', async () => {
        // Given - the canonical browser project
        const project = await component();

        // Then - an entry both included and excluded is fatal to Vite 6 and 7's optimizer, and `@vitest/browser` excludes exactly these two
        expect(project.optimizeDeps?.include).not.toContain('msw');
        expect(project.optimizeDeps?.include).not.toContain('msw/browser');
    });

    test('keeps the whole project out of specs/ until an include says otherwise', async () => {
        // Given - the default project, and one that states where its components live
        const canonical = testOf(await component());
        const stated = testOf(await component({ include: ['specs/app/**/*.test.tsx'] }));

        // Then - the default exclusion is the default include's twin, never the stated one's
        expect(canonical.include).toStrictEqual(['**/*.test.tsx']);
        expect(canonical.exclude).toContain('specs/**');
        expect(stated.exclude).not.toContain('specs/**');
    });

    test('hands the page what it cannot read for itself', async () => {
        // Given - a project pinning the clock for every render
        const project = testOf(await component({ clock: '2026-03-04T09:30:00.000Z' }));

        // Then - update mode, the instant and the page size cross as values
        expect(project.provide).toStrictEqual({
            componentClock: '2026-03-04T09:30:00.000Z',
            componentViewport: { height: 720, width: 1280 },
            update: false,
        });
    });

    test('loads the project wrap through a setup file, not a fetch under the run', async () => {
        // Given - a project whose providers live in a module of its own
        const project = testOf(
            await component({ root: process.cwd(), wrap: './specs/component-app/providers.tsx' }),
        );
        const setup = project.setupFiles;

        // Then - the wrap is in the graph before the first test, from .artifacts/
        expect(setup).toHaveLength(1);
        expect(String(setup)).toContain('.artifacts/vitest/component-setup.mjs');
    });

    test('reads a relative path against the config that stated it, not the cwd', () => {
        // Given - the config of an app in a subdirectory, loaded from the package root the way knip and the type-checker load every config
        const nested = resolve(import.meta.dirname, '_fixtures/nested-app');
        const project = testOf(nestedApp);

        // Then - both of its relative paths landed beside it, and neither here
        expect(nestedApp.define).toStrictEqual({ __NESTED_APP__: 'true' });
        expect(project.setupFiles).toStrictEqual([
            resolve(nested, '.artifacts/vitest/component-setup.mjs'),
        ]);
        expect(readFileSync(String(project.setupFiles), 'utf8')).toContain(
            resolve(nested, 'providers.ts'),
        );
    });

    test('keeps the pipeline of a consumer vite config and drops where its app lives', async () => {
        // Given - an app config that roots itself elsewhere and builds a bundle
        const project = await component({
            vite: {
                build: { outDir: 'build' },
                define: { __APP__: 'true' },
                root: '/somewhere/else',
                server: { port: 4321 },
            },
        });

        // Then - only the pipeline survives; the project still collects from here
        expect(project.define).toStrictEqual({ __APP__: 'true' });
        expect(project).not.toHaveProperty('root');
        expect(project).not.toHaveProperty('build');
    });

    test('keeps a consumer JSX transform rather than stating its own over it', async () => {
        // Given - an app compiling JSX through another library's runtime
        const stated = await component({ vite: { oxc: { jsx: { importSource: 'preact' } } } });
        const canonical = await component();

        // Then - the app's statement stands, and only a silent project gets the default
        expect(stated.oxc).toStrictEqual({ jsx: { importSource: 'preact' } });
        expect(canonical.oxc).toStrictEqual({ jsx: { runtime: 'automatic' } });
    });

    test('states the JSX default on the key the installed vite transforms with', async () => {
        // Given - the canonical project against the vite this package installs
        const project = await component();

        // Then - never both: vite 8 warns for every esbuild option beside an oxc one
        expect('esbuild' in project && 'oxc' in project).toBeFalsy();
    });

    test('concatenates a consumer plugin after the worker the seam serves', async () => {
        // Given - an app config carrying a plugin of its own
        const project = await component({ vite: { plugins: [{ name: 'app:svg' }] } });

        // Then - the seam's plugin is kept and the consumer's joins it
        expect(pluginNames(project)).toStrictEqual(['@jterrazz/test:msw-worker', 'app:svg']);
    });
});

describe('the node facet helpers — one canonical project per kind', () => {
    test('each collects its own facet tree, under its own name', () => {
        // Given - the canonical projects, stated by nobody
        // Then - `--project api` means the same tree in every repository
        expect(
            [api(), jobs(), integration(), mobile()].map((project) => testOf(project).name),
        ).toStrictEqual(['api', 'jobs', 'integration', 'mobile']);
        // The suffix is the fork: a facet collects the ASSEMBLED product, and
        // The word for that is `.spec.ts`.
        expect(testOf(api()).include).toStrictEqual(['specs/api/**/*.spec.ts']);
        expect(testOf(integration()).include).toStrictEqual(['specs/integration/**/*.spec.ts']);
    });

    test('node facets run first, and the simulator runs alone at the end', () => {
        // Given - the group order each helper states
        const orders = [api(), jobs(), integration(), cli(), mobile()].map(
            (project) => testOf(project).sequence?.groupOrder,
        );

        // Then - everything node shares group 0; website is 1, component 2, and a simulator cannot share a machine with itself
        expect(orders).toStrictEqual([0, 0, 0, 0, 3]);
    });

    test('takes the tree and the budget a repository states instead', () => {
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
        // The preset's own exclusions are never dropped — vite concatenates,
        // So a repository ADDS to `_fixtures/` rather than having to restate it.
        expect(stated.exclude).toContain('specs/api/slow/**');
        expect(stated.exclude).toContain('**/_fixtures/**');
        expect(stated.testTimeout).toBe(90_000);
        expect(stated.name).toBe('api');
    });

    test('a node facet states its own serial run, the way website() does', () => {
        // Given - an integration suite whose files share one database file
        const shared = testOf(integration({ serial: true }));

        // Then - the project states it, and a silent helper states nothing
        expect(shared.fileParallelism).toBe(false);
        expect(testOf(integration()).fileParallelism).toBeUndefined();
    });

    test('every helper takes it, not only the ones 15.2 shipped it on', () => {
        // Given - the four other helpers this release adds
        const serial = [api, jobs, mobile].map((helper) => testOf(helper({ serial: true })));

        // Then - `serial` is what chapter 02 says it is: every helper's
        expect(serial.map((project) => project.fileParallelism)).toStrictEqual([
            false,
            false,
            false,
        ]);
        expect(testOf(cli({ literate: false, serial: true })).fileParallelism).toBe(false);
    });

    test('cli() wires the literate door by default', () => {
        // Given - the canonical cli project
        // Then - the plugin that turns a document into a test file is there
        expect(pluginNames(cli())).toContain('jterrazz-test:literate');
    });

    test('cli({ literate: false }) collects no documents', () => {
        // Given - a repository whose cli facet has no documents
        // Then - the plugin is absent, and nothing else changed
        expect(pluginNames(cli({ literate: false }))).toStrictEqual([]);
        expect(testOf(cli({ literate: false })).name).toBe('cli');
    });
});
