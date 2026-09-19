import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { component, unit } from './projects.js';

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

    test('registers the golden pair and the ARIA producer as server commands', async () => {
        // Given - the project's browser block
        const project = testOf(await component());

        // Then - the three things a page cannot do for itself are reachable from it
        expect(Object.keys(project.browser?.commands ?? {}).toSorted()).toStrictEqual([
            'ariaTree',
            'goldenRead',
            'goldenWrite',
        ]);
    });

    test('pre-bundles the seam so a cold cache never reloads the tester mid-run', async () => {
        // Given - the canonical browser project on this install
        const project = await component();

        // Then - react and the two adapters are declared up front
        expect(project.optimizeDeps?.include).toContain('vitest-browser-react');
        expect(project.optimizeDeps?.include).toContain('msw/browser');
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

        // Then - update mode and the instant cross as values; a page has neither
        expect(project.provide).toStrictEqual({
            componentClock: '2026-03-04T09:30:00.000Z',
            update: false,
        });
    });

    test('loads the project wrap through a setup file, not a fetch under the run', async () => {
        // Given - a project whose providers live in a module of its own
        const project = testOf(await component({ wrap: './specs/component-app/providers.tsx' }));
        const setup = project.setupFiles;

        // Then - the wrap is in the graph before the first test, from .artifacts/
        expect(setup).toHaveLength(1);
        expect(String(setup)).toContain('.artifacts/vitest/component-setup.mjs');
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

    test('concatenates a consumer plugin after the worker the seam serves', async () => {
        // Given - an app config carrying a plugin of its own
        const project = await component({ vite: { plugins: [{ name: 'app:svg' }] } });

        // Then - the seam's plugin is kept and the consumer's joins it
        expect(pluginNames(project)).toStrictEqual(['@jterrazz/test:msw-worker', 'app:svg']);
    });
});
