import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import type { Plugin, PluginOption, UserConfig, UserConfigFn } from 'vite';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { SCREENSHOTS_DIR, VITEST_ARTIFACTS_DIR } from '../../../lint/kit/project/artifacts.js';
import { isRecord } from '../../../lint/kit/project/json-shape.js';
import { callerFrames } from '../../chain/paths/caller.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { shouldUpdateSnapshots } from '../../expectations/in-place/update.js';
import { mswWorkerScript } from '../../stubs/delivery/browser-page/worker-script.js';
import type { SpecificationProjectOptions } from '../../vitest/project.js';
import { onProjectDefaults, projectTest } from '../../vitest/project.js';
import { COMPONENT_COMMANDS } from './golden/commands.js';
import {
    assertProviderPin,
    installedVersion,
    transformKey,
    versionOf,
} from './peers/peer-versions.js';

export type ComponentOptions = {
    /** Freeze the page's `Date` for every render of the project. */
    clock?: string;
    /** `Accept-Language` and `Intl` locale of the page. Default `'en-US'`. */
    locale?: string;
    /** The directory `vite` and `wrap` resolve against; defaults to the calling file's. */
    root?: string;
    /** IANA zone the page's `Date` reports in. Default `'UTC'`. */
    timezone?: string;
    /** The app's Vite pipeline: a config path, the object, or a framework's function. Only the pipeline is adopted. */
    vite?: Promise<UserConfig> | string | UserConfig | UserConfigFn;
    /** The page size every render gets. Default 1280×720. */
    viewport?: { height: number; width: number };
    /** A module whose default export `(ui) => ReactNode` wraps every render; a router is a test's Given, on the chain. */
    wrap?: string;
};

/** `component()`: rendered units, in the `__tests__/` of the folder of the components they cover; under a specs tree, beside them. */
export type ComponentProjectOptions = ComponentOptions & SpecificationProjectOptions;

const PIPELINE_KEYS = [
    'assetsInclude',
    'css',
    'define',
    'envPrefix',
    'esbuild',
    'json',
    'optimizeDeps',
    'oxc',
    'plugins',
    'resolve',
] as const;

// outside: pre-bundled so a cold cache never reloads mid-run. `msw` is left out: `@vitest/browser` already excludes it, and an entry both included and excluded is fatal to Vite's optimizer.
const PAGE_DEPENDENCIES = [
    'react',
    'react-dom/client',
    'react/jsx-dev-runtime',
    'react/jsx-runtime',
    'vitest-browser-react',
    'vitest-mock-extended',
];

const requireFrom = createRequire(import.meta.url);
const HELPERS_FILE = import.meta.filename;

// invariant: a config vite bundled before importing it: `<its name>.timestamp-<hash>.mjs`.
const BUNDLED_CONFIG = /^(?<name>.+)\.timestamp-[^.]+\.mjs$/u;

function callerFile(): string | undefined {
    // Stryker disable next-line OptionalChaining: a frame outside this file always calls it, so the find always holds one
    return callerFrames().find(({ file }) => file !== HELPERS_FILE)?.file;
}

function nearestHolding(name: string): string | undefined {
    let directory = process.cwd();
    for (;;) {
        if (existsSync(resolve(directory, name))) {
            return directory;
        }
        const parent = dirname(directory);
        if (parent === directory) {
            return undefined;
        }
        directory = parent;
    }
}

// outside: never `process.cwd()`: knip and `typescript check` load configs from the repository root. Read off the stack; Vite's own loader bundles the config into `node_modules/.vite-temp/`, keeping only its name, looked for upward from the cwd.
function callerDirectory(): string {
    const file = callerFile();
    // Stryker disable next-line ConditionalExpression: a frame outside this file always calls it
    if (file === undefined) {
        return process.cwd();
    }
    // Stryker disable next-line OptionalChaining: a match of the pattern always holds its one named group
    const bundled = BUNDLED_CONFIG.exec(basename(file))?.groups?.name;
    if (bundled === undefined || basename(dirname(file)) !== '.vite-temp') {
        // invariant: bundled beside the config or not bundled: either way the frame sits in the config's own directory.
        return dirname(file);
    }
    return nearestHolding(bundled) ?? process.cwd();
}

// invariant: an absent optional peer is simply not pre-bundled.
function resolves(specifier: string): boolean {
    try {
        // Stryker disable next-line CallExpression: every page dependency resolves on this package's own install, so its tests never meet an absent one
        requireFrom.resolve(specifier);
        return true;
    } catch {
        return false;
    }
}

// outside: with the scope header a worker registered at `/` needs.
function mswWorkerPlugin(): Plugin {
    return {
        configureServer(server) {
            const script = mswWorkerScript();
            server.middlewares.use('/mockServiceWorker.js', (_request, response) => {
                response.setHeader('content-type', 'text/javascript');
                response.setHeader('service-worker-allowed', '/');
                response.end(readFileSync(script, 'utf8'));
            });
        },
        name: '@jterrazz/test:msw-worker',
    };
}

const isPluginList = (plugins: unknown): plugins is PluginOption[] => Array.isArray(plugins);

// invariant: an allow-list: an unknown key (`environments`, `ssr`, ...) could re-root the run. The consumer's `plugins` are concatenated after the project's.
async function reroot(
    source: NonNullable<ComponentProjectOptions['vite']>,
    root: string,
): Promise<Record<string, unknown>> {
    const environment = { command: 'serve', isSsrBuild: false, mode: 'test' } as const;
    let loaded: unknown;
    let found: string;
    let fix: string;
    if (typeof source === 'string') {
        const { loadConfigFromFile } = await import('vite');
        // outside: `loadConfigFromFile` resolves a relative path against the tool's cwd, not the config's.
        const from = isAbsolute(source) ? source : resolve(root, source);
        const file = await loadConfigFromFile(environment, from);
        // Stryker disable OptionalChaining,StringLiteral: vite's loader throws itself on a path holding no config, or one exporting no object, before this refusal
        loaded = file?.config;
        found = `${from} exports no config`;
        fix = "point `vite` at the app's own vite.config.ts";
        // Stryker restore OptionalChaining,StringLiteral
    } else if (typeof source === 'function') {
        loaded = await source(environment);
        if (typeof loaded === 'function') {
            found = 'the config function returned a function, not a config';
            fix =
                "call the framework's factory and pass what it returns (for Astro, `getViteConfig({}, { root: import.meta.dirname })`, never `getViteConfig`)";
        } else {
            found = 'the config function returned no config';
            fix =
                "return the framework's config from the function (for Astro, `getViteConfig({}, { root: import.meta.dirname })`)";
        }
    } else {
        loaded = await source;
        found = 'the config promise resolved to no config';
        fix = "resolve the promise to the framework's config object";
    }
    if (typeof loaded !== 'object' || loaded === null) {
        throw new Error(
            refusal({
                fix,
                found: `component({ vite }): ${found}`,
                read: 'docs/guides/component-specs.md#the-constructor-there-is-none',
                why: 'A component renders through the Vite pipeline the app builds with, read from its config.',
            }),
        );
    }

    // Stryker disable next-line ConditionalExpression,StringLiteral: this package installs vite 8, so its own tests never meet a vite that transforms with esbuild
    const inactive = transformKey() === 'oxc' ? 'esbuild' : 'oxc';
    const kept: Record<string, unknown> = {};
    const config: Record<string, unknown> = { ...loaded };
    for (const key of PIPELINE_KEYS) {
        if (key !== inactive) {
            kept[key] = config[key];
        }
    }
    return kept;
}

function optimizeDepsOf(declared: unknown): Record<string, unknown> & { include: string[] } {
    const own = isRecord(declared) ? { ...declared } : {};
    const listed = 'include' in own && Array.isArray(own.include) ? own.include : [];
    return {
        ...own,
        include: [
            ...new Set([
                // Stryker disable next-line MethodExpression: every page dependency resolves on this package's own install
                ...PAGE_DEPENDENCIES.filter(resolves),
                ...listed.filter((entry): entry is string => typeof entry === 'string'),
            ]),
        ],
    };
}

// invariant: a consumer's `jsxImportSource` or classic runtime wins.
function jsxPipeline(pipeline: Record<string, unknown>): Record<string, unknown> {
    const key = transformKey();
    const stated = pipeline[key];
    // Stryker disable next-line ConditionalExpression: this package installs vite 8, so its own tests never meet a vite that transforms with esbuild
    if (key === 'oxc') {
        return { oxc: stated ?? { jsx: { runtime: 'automatic' } } };
    }
    return { esbuild: stated ?? { jsx: 'automatic' } };
}

// outside: a static import: a dependency discovered mid-run makes the optimizer rewrite its cache and every held module 404s. Written to disk because vitest resolves `setupFiles` as paths; handed over on a shared `globalThis` symbol, the two graphs sharing no module.
function writeSetupFile(wrap: string, root: string): string {
    const absolute = resolve(root, wrap);
    const path = resolve(root, VITEST_ARTIFACTS_DIR, 'component-setup.mjs');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
        path,
        [
            '// Generated by `component({ wrap })` of @jterrazz/test. Do not edit.',
            `import wrap from ${JSON.stringify(absolute)};`,
            "globalThis[Symbol.for('@jterrazz/test:component-wrap')] = wrap;",
            '',
        ].join('\n'),
        'utf8',
    );
    return path;
}

// invariant: update mode is a `process.env`/`argv` read the page cannot make.
function providedToPage(options: ComponentProjectOptions): {
    componentClock?: string;
    componentViewport: { height: number; width: number };
    update: boolean;
} {
    return {
        ...(options.clock === undefined ? {} : { componentClock: options.clock }),
        componentViewport: viewportOf(options),
        update: shouldUpdateSnapshots(),
    };
}

function viewportOf(options: ComponentProjectOptions): { height: number; width: number } {
    return options.viewport ?? { height: 720, width: 1280 };
}

/** A component project: renders in a real Chromium; the default `exclude` keeps it out of `specs/`. */
export async function component(
    options: ComponentProjectOptions = {},
): Promise<TestProjectInlineConfiguration> {
    // hazard: read before the first `await`: the caller's frame is on the stack only during the synchronous body.
    const root = options.root ?? callerDirectory();
    // Stryker disable next-line CallExpression: this package installs the provider on its runner's version, so its tests never meet a mismatch here; the peer-versions test refuses one
    assertProviderPin(versionOf('vitest'), installedVersion('@vitest/browser-playwright'));
    const { playwright } = await import('@vitest/browser-playwright');
    const pipeline = options.vite === undefined ? {} : await reroot(options.vite, root);
    const consumerPlugins = isPluginList(pipeline.plugins) ? pipeline.plugins : [];

    const project = {
        ...pipeline,
        ...jsxPipeline(pipeline),
        optimizeDeps: optimizeDepsOf(pipeline.optimizeDeps),
        plugins: [mswWorkerPlugin(), ...consumerPlugins],
        test: {
            browser: {
                commands: COMPONENT_COMMANDS,
                enabled: true,
                // outside: a reference screenshot is a golden with its own Vitest 5 option, apart from the failure screenshot.
                expect: { toMatchScreenshot: { screenshotDirectory: SCREENSHOTS_DIR } },
                headless: true,
                instances: [{ browser: 'chromium' as const }],
                provider: playwright({
                    contextOptions: {
                        locale: options.locale ?? 'en-US',
                        timezoneId: options.timezone ?? 'UTC',
                    },
                }),
                screenshotDirectory: SCREENSHOTS_DIR,
                viewport: viewportOf(options),
            },
            ...projectTest('component', options, {
                exclude: options.include === undefined ? ['specs/**'] : [],
                include: ['**/*.test.tsx'],
            }),
            provide: providedToPage(options),
            ...(options.wrap === undefined
                ? {}
                : { setupFiles: [writeSetupFile(options.wrap, root)] }),
            sequence: { groupOrder: 2 },
        },
    };
    return onProjectDefaults(project);
}
