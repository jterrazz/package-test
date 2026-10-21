import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigEnv } from 'vite';
import { describe, expect, test } from 'vitest';

import { component } from '../component.project.js';
import bundledApp from './__fixtures__/bundled-app/.vite-temp/bundled-app.config.ts.timestamp-1.mjs';
import plainApp from './__fixtures__/bundled-app/.vite-temp/plain.config.mjs';
import besideApp from './__fixtures__/bundled-app/beside.config.ts.timestamp-1.mjs';
import nestedApp from './__fixtures__/nested-app/vitest.config.js';
import {
    pluginNames,
    returnsNothing,
    setupFileIn,
    testOf,
    untyped,
} from './component.project.fixtures.js';

describe('component', () => {
    test('component() — the browser project — runs headless chromium, in the group every project shares', async () => {
        // Given - the canonical browser project
        const project = testOf(await component());

        // Then - one browser, no window, and the node kinds' group
        expect(project.browser?.enabled).toBe(true);
        expect(project.browser?.headless).toBe(true);
        expect(project.browser?.instances).toStrictEqual([{ browser: 'chromium' }]);
        expect(project.sequence).toStrictEqual({ groupOrder: 0 });
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

    test("component() — the browser project — pre-bundles only the page's own when the app's declaration is no list of names", async () => {
        // Given - configs an untyped caller wrote: pre-bundling stated as a word, and a list holding a non-name
        const canonical = await component();
        const page = canonical.optimizeDeps?.include;
        const worded = await component({ vite: untyped({ optimizeDeps: 'react-router' }) });
        const mixed = await component({
            vite: untyped({ optimizeDeps: { include: [7, 'react-router'] } }),
        });
        const included = await component({
            vite: untyped({ optimizeDeps: { include: 'react-router' } }),
        });

        // Then - the word is no declaration, the non-name is dropped, and a word under include is no list
        expect([
            worded.optimizeDeps?.include,
            mixed.optimizeDeps?.include,
            included.optimizeDeps?.include,
        ]).toStrictEqual([page, [...(page ?? []), 'react-router'], page]);
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
        const plain = testOf(await component());
        const stated = testOf(await component({ include: ['specs/app/**/*.test.tsx'] }));

        // Then - the default exclusion is the default include's twin, never the stated one's
        expect(plain.include).toStrictEqual(['**/*.test.tsx']);
        expect(plain.exclude).toContain('specs/**');
        expect(stated.exclude).toStrictEqual(plain.exclude?.filter((one) => one !== 'specs/**'));
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

        // Then - the wrap is in the graph before the first test, from .artifacts/, handed to the page on its shared symbol
        expect(setup).toHaveLength(1);
        expect(String(setup)).toContain('.artifacts/vitest/component-setup.mjs');
        const wrap = JSON.stringify(resolve(process.cwd(), 'specs/component/wrap/providers.tsx'));
        expect(readFileSync(String(setup), 'utf8')).toBe(
            `// Generated by \`component({ wrap })\` of @jterrazz/test. Do not edit.\nimport wrap from ${wrap};\nglobalThis[Symbol.for('@jterrazz/test:component-wrap')] = wrap;\n`,
        );
    });

    test('component() — the browser project — reads a relative path against the config that stated it, not the cwd', () => {
        // Given - the config of an app in a subdirectory, loaded from the package root the way knip and the type-checker load every config
        const nested = resolve(import.meta.dirname, '__fixtures__/nested-app');
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
        // Given - an app config that roots itself elsewhere, builds a bundle, leaves a key undefined and states esbuild options
        const project = await component({
            vite: untyped({
                build: { outDir: 'build' },
                define: { __APP__: 'true' },
                esbuild: { jsx: 'automatic' },
                json: undefined,
                root: '/somewhere/else',
                server: { port: 4321 },
            }),
        });

        // Then - only the pipeline survives, neither a key left undefined nor the transform vite 8 replaced; the project still collects from here
        expect(project.define).toStrictEqual({ __APP__: 'true' });
        const dropped = ['root', 'build', 'esbuild', 'json'].filter((key) => key in project);
        expect(dropped).toStrictEqual([]);
    });

    test("component() — the browser project — calls a framework's config function as a dev server under test, and keeps only its pipeline", async () => {
        // Given - a config function shaped like Astro's getViteConfig(): it loads vite, then merges the app's config over the framework's
        const environments: ConfigEnv[] = [];
        const project = await component({
            vite: async (environment) => {
                environments.push(environment);
                const { mergeConfig } = await import('vite');
                return mergeConfig(
                    { plugins: [{ name: 'framework:pages' }], root: '/framework/app' },
                    {
                        define: { 'import.meta.env.SITE': '"https://example.com"' },
                        server: { port: 4321 },
                    },
                );
            },
        });

        // Then - called once as a test-mode dev server; its pipeline joins the project, its place does not
        expect(environments).toStrictEqual([{ command: 'serve', isSsrBuild: false, mode: 'test' }]);
        expect(project.define).toStrictEqual({ 'import.meta.env.SITE': '"https://example.com"' });
        expect(pluginNames(project)).toStrictEqual([
            '@jterrazz/test:msw-worker',
            'framework:pages',
        ]);
        expect(project).not.toHaveProperty('root');
        expect(project).not.toHaveProperty('server');
    });

    test.each([
        {
            fix: "return the framework's config from the function",
            found: 'the config function returned no config',
            source: untyped(returnsNothing),
        },
        {
            fix: "call the framework's factory and pass what it returns",
            found: 'the config function returned a function, not a config',
            source: untyped(() => returnsNothing),
        },
        {
            fix: "resolve the promise to the framework's config object",
            found: 'the config promise resolved to no config',
            source: untyped(returnsNothing()),
        },
        {
            fix: "resolve the promise to the framework's config object",
            found: 'the config promise resolved to no config',
            source: untyped(Promise.resolve(null)),
        },
    ])(
        "component() — the browser project — refuses a source that yields no config object, in its own form's words: $found",
        async ({ fix, found, source }) => {
            // Given - a vite source an untyped caller wrote, yielding no config object
            const loading = component({ vite: source });

            // Then - the refusal's found and fix both name the form it was written in
            await expect(loading).rejects.toThrow(
                `found: component({ vite }): ${found}\nwhy: A component renders through the Vite pipeline the app builds with, read from its config.\nfix: ${fix}`,
            );
            await expect(loading).rejects.toThrow(
                /\nread: docs\/guides\/component-specs\.md#the-constructor-there-is-none$/u,
            );
        },
    );

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
        expect('esbuild' in project && 'oxc' in project).toBe(false);
    });

    test('component() — the browser project — concatenates a consumer plugin after the worker the project serves', async () => {
        // Given - an app config carrying a plugin of its own
        const project = await component({ vite: { plugins: [{ name: 'app:svg' }] } });

        // Then - the project's plugin is kept and the consumer's joins it
        expect(pluginNames(project)).toStrictEqual(['@jterrazz/test:msw-worker', 'app:svg']);
    });

    test('component() — the browser project — states the page it renders on, and nothing a caller left unstated', async () => {
        // Given - the canonical project, and one stating its locale and zone
        const canonical = await component();
        const stated = await component({ locale: 'fr-FR', timezone: 'Europe/Paris' });

        // Then - the project's name, its screenshot folder, its context, and no clock, no plugin and no wrap of a caller's
        expect([
            canonical.test?.name,
            canonical.test?.browser?.expect,
            canonical.test?.browser?.provider?.options,
            stated.test?.browser?.provider?.options,
            canonical.test?.provide,
            canonical.plugins?.length,
        ]).toStrictEqual([
            'component',
            { toMatchScreenshot: { screenshotDirectory: '.artifacts/vitest/screenshots' } },
            { contextOptions: { locale: 'en-US', timezoneId: 'UTC' } },
            { contextOptions: { locale: 'fr-FR', timezoneId: 'Europe/Paris' } },
            { componentViewport: { height: 720, width: 1280 }, update: false },
            1,
        ]);
    });

    test('component() — the browser project — reads a config vite bundled against the folder holding its name, upward from the cwd', () => {
        // Given - a config vite's loader bundled under .vite-temp/, whose name no folder above the cwd holds
        const project = bundledApp;

        // Then - neither the bundle's folder nor the fixture's: the cwd, where the walk found nothing nearer; a config bundled beside itself, or named like no bundle, keeps its own folder
        const fixtures = resolve(import.meta.dirname, '__fixtures__/bundled-app');
        expect([project, besideApp, plainApp].map((one) => testOf(one).setupFiles)).toStrictEqual([
            setupFileIn(process.cwd()),
            setupFileIn(fixtures),
            setupFileIn(resolve(fixtures, '.vite-temp')),
        ]);
    });
});
