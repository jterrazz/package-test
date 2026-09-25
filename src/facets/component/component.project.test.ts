import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { component } from './component.project.js';
import nestedApp from './fixtures/nested-app/vitest.config.js';

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

describe('component', () => {
    test('component() — the browser project — runs headless chromium, and last of the groups', async () => {
        // Given - the canonical browser project
        const project = testOf(await component());

        // Then - one browser, no window, and a group of its own after website's
        expect(project.browser?.enabled).toBeTruthy();
        expect(project.browser?.headless).toBeTruthy();
        expect(project.browser?.instances).toStrictEqual([{ browser: 'chromium' }]);
        expect(project.sequence).toStrictEqual({ groupOrder: 2 });
    });

    test('component() — the browser project — keeps what Browser Mode leaks under the artefact folder', async () => {
        // Given - the canonical browser project
        const project = testOf(await component());

        // Then - neither screenshots nor attachments land on the row
        expect(project.browser?.screenshotDirectory).toBe('.artifacts/vitest/screenshots');
        expect(project.attachmentsDir).toBe('.artifacts/vitest/attachments');
    });

    test('component() — the browser project — registers the golden pair and the ARIA producer as server commands', async () => {
        // Given - the project's browser block
        const project = testOf(await component());

        // Then - the four things a page cannot do for itself are reachable from it
        expect(Object.keys(project.browser?.commands ?? {}).toSorted()).toStrictEqual([
            'ariaTree',
            'goldenRead',
            'goldenWrite',
            'inPlaceWrite',
        ]);
    });

    test('component() — the browser project — pre-bundles the page runtime so a cold cache never reloads the tester mid-run', async () => {
        // Given - the canonical browser project on this install
        const project = await component();

        // Then - react, the react adapter and what the package's browser entry imports are declared up front
        expect(project.optimizeDeps?.include).toContain('vitest-browser-react');
        expect(project.optimizeDeps?.include).toContain('react-dom/client');
        expect(project.optimizeDeps?.include).toContain('vitest-mock-extended');
    });

    test("component() — the browser project — pre-bundles what the app's own Vite config declares, beside the page's own", async () => {
        // Given - an app whose components import a dependency the page runtime knows nothing of
        const project = await component({ vite: { optimizeDeps: { include: ['react-router'] } } });

        // Then - both are declared up front: a dependency found mid-run reloads the tester
        expect(project.optimizeDeps?.include).toContain('react-router');
        expect(project.optimizeDeps?.include).toContain('vitest-browser-react');
    });

    test('component() — the browser project — leaves msw to the runner, which already excludes it', async () => {
        // Given - the canonical browser project
        const project = await component();

        // Then - an entry both included and excluded is fatal to Vite 6 and 7's optimizer, and `@vitest/browser` excludes exactly these two
        expect(project.optimizeDeps?.include).not.toContain('msw');
        expect(project.optimizeDeps?.include).not.toContain('msw/browser');
    });

    test('component() — the browser project — keeps the whole project out of specs/ until an include says otherwise', async () => {
        // Given - the default project, and one that states where its components live
        const canonical = testOf(await component());
        const stated = testOf(await component({ include: ['specs/app/**/*.test.tsx'] }));

        // Then - the default exclusion is the default include's twin, never the stated one's
        expect(canonical.include).toStrictEqual(['**/*.test.tsx']);
        expect(canonical.exclude).toContain('specs/**');
        expect(stated.exclude).not.toContain('specs/**');
    });

    test('component() — the browser project — hands the page what it cannot read for itself', async () => {
        // Given - a project pinning the clock for every render
        const project = testOf(await component({ clock: '2026-03-04T09:30:00.000Z' }));

        // Then - update mode, the instant and the page size cross as values
        expect(project.provide).toStrictEqual({
            componentClock: '2026-03-04T09:30:00.000Z',
            componentViewport: { height: 720, width: 1280 },
            update: false,
        });
    });

    test('component() — the browser project — loads the project wrap through a setup file, not a fetch under the run', async () => {
        // Given - a project whose providers live in a module of its own
        const project = testOf(
            await component({ root: process.cwd(), wrap: './specs/component/wrap/providers.tsx' }),
        );
        const setup = project.setupFiles;

        // Then - the wrap is in the graph before the first test, from .artifacts/
        expect(setup).toHaveLength(1);
        expect(String(setup)).toContain('.artifacts/vitest/component-setup.mjs');
    });

    test('component() — the browser project — reads a relative path against the config that stated it, not the cwd', () => {
        // Given - the config of an app in a subdirectory, loaded from the package root the way knip and the type-checker load every config
        const nested = resolve(import.meta.dirname, 'fixtures/nested-app');
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

    test('component() — the browser project — keeps the pipeline of a consumer vite config and drops where its app lives', async () => {
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

    test('component() — the browser project — keeps a consumer JSX transform rather than stating its own over it', async () => {
        // Given - an app compiling JSX through another library's runtime
        const stated = await component({ vite: { oxc: { jsx: { importSource: 'preact' } } } });
        const canonical = await component();

        // Then - the app's statement stands, and only a silent project gets the default
        expect(stated.oxc).toStrictEqual({ jsx: { importSource: 'preact' } });
        expect(canonical.oxc).toStrictEqual({ jsx: { runtime: 'automatic' } });
    });

    test('component() — the browser project — states the JSX default on the key the installed vite transforms with', async () => {
        // Given - the canonical project against the vite this package installs
        const project = await component();

        // Then - never both: vite 8 warns for every esbuild option beside an oxc one
        expect('esbuild' in project && 'oxc' in project).toBeFalsy();
    });

    test('component() — the browser project — concatenates a consumer plugin after the worker the project serves', async () => {
        // Given - an app config carrying a plugin of its own
        const project = await component({ vite: { plugins: [{ name: 'app:svg' }] } });

        // Then - the project's plugin is kept and the consumer's joins it
        expect(pluginNames(project)).toStrictEqual(['@jterrazz/test:msw-worker', 'app:svg']);
    });
});
