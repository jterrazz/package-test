import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, UserConfig, UserConfigFn } from 'vite';
import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { SCREENSHOTS_DIR, VITEST_ARTIFACTS_DIR } from '../../core/artifacts/artifacts.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';
import { projectDefaults } from '../../runner/preset.js';
import { COMPONENT_COMMANDS } from '../../seams/vitest-browser/commands.js';

/** `component()` — rendered units, beside the components they cover. */
export type ComponentProjectOptions = {
    /** Freeze the page's `Date` for every render of the project. */
    clock?: string;
    /** `Accept-Language` and `Intl` locale of the page. Default `'en-US'`. */
    locale?: string;
    /**
     * The directory `vite` and `wrap` are resolved against. Default: the
     * directory of the file that CALLED the helper — see
     * {@link callerDirectory}. State it when the call is not written in the
     * config it configures (a shared config factory).
     */
    root?: string;
    /** IANA zone the page's `Date` reports in. Default `'UTC'`. */
    timezone?: string;
    /**
     * The app's own Vite pipeline: a config path, the object, or the function
     * a framework exports. Only the PIPELINE is adopted (see {@link reroot}).
     */
    vite?: Promise<UserConfig> | string | UserConfig | UserConfigFn;
    /** The page size every render gets. Default 1280×720. */
    viewport?: { height: number; width: number };
    /**
     * A module whose default export is `(ui) => ReactNode` — the providers
     * every render of this project is dressed in (a theme, a store, an intl
     * provider). A router belongs on the chain instead: it is a test's Given.
     */
    wrap?: string;
} & FacetProjectOptions;

/** The pipeline keys a consumer's Vite config contributes, and nothing else. */
const PIPELINE_KEYS = [
    'assetsInclude',
    'css',
    'define',
    'envPrefix',
    'esbuild',
    'json',
    'oxc',
    'plugins',
    'resolve',
] as const;

/**
 * The seam's own runtime, pre-bundled so a cold cache never reloads mid-run.
 *
 * `msw` and `msw/browser` are NOT here: `@vitest/browser` already puts both in
 * `optimizeDeps.exclude`, and Vite's esbuild optimizer (6 and 7) treats an
 * entry that is both included and excluded as fatal — dependency optimisation
 * throws before a single test runs.
 */
const SEAM_DEPENDENCIES = [
    'react',
    'react-dom/client',
    'react/jsx-dev-runtime',
    'react/jsx-runtime',
    'vitest-browser-react',
];

const requireFrom = createRequire(import.meta.url);

/** This module's own file — the frames the caller search walks past. */
const HELPERS_FILE = import.meta.filename;

/** A stack frame's file, in either of the two shapes V8 prints it in. */
const STACK_FRAME = /(?:\((?<wrapped>[^()]+):\d+:\d+\)|at (?<bare>[^()\s]+):\d+:\d+)$/u;

/** A config vite bundled before importing it — `<its name>.timestamp-<hash>.mjs`. */
const BUNDLED_CONFIG = /^(?<name>.+)\.timestamp-[^.]+\.mjs$/u;

/** The file of the first frame below this module — who called the helper. */
function callerFile(): string | undefined {
    // The error is never thrown and never read as a message: asking V8 who
    // Called is what a stack is for, and the string says so where one prints.
    const { stack } = new Error('@jterrazz/test: reading the call site of a project helper');
    for (const frame of stack?.split('\n').slice(1) ?? []) {
        const groups = STACK_FRAME.exec(frame.trim())?.groups;
        const location = groups?.wrapped ?? groups?.bare;
        if (location === undefined || location.startsWith('node:')) {
            continue;
        }
        const file = location.startsWith('file:') ? fileURLToPath(location) : location;
        if (file !== HELPERS_FILE) {
            return file;
        }
    }
    return undefined;
}

/** The nearest directory at or above the cwd holding a file of this name. */
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

/**
 * The directory of the CONFIG that called a helper — what the relative paths
 * it was handed mean.
 *
 * Not `process.cwd()`: a `vitest.config.ts` is read by more tools than the
 * runner, and knip and `typescript check` load every config of a repository
 * from the repository ROOT — `component({ vite: './web/vite.config.ts' })`
 * written beside an app resolved against the wrong tree and threw before a
 * single test ran. `import.meta` cannot answer either: it describes THIS
 * module. And vitest hands a project neither its root nor its config file — a
 * project function is called with `{ command, mode, isPreview, isSsrBuild }`
 * and nothing else.
 *
 * So the call site is read off the stack, where a loader that keeps a config's
 * identity (node, tsx, jiti — what those tools use) names the file itself.
 * Vite's own loader does not: it BUNDLES the config into
 * `node_modules/.vite-temp/` and only the config's NAME survives the move. The
 * name is what is then looked for upward from the cwd, because that loader is
 * the runner's and a runner is started in the tree it tests. A config loaded
 * by the runner from another tree entirely states `root` itself.
 */
function callerDirectory(): string {
    const file = callerFile();
    if (file === undefined) {
        return process.cwd();
    }
    const bundled = BUNDLED_CONFIG.exec(basename(file))?.groups?.name;
    if (bundled === undefined || basename(dirname(file)) !== '.vite-temp') {
        // Bundled beside the config (no node_modules above it) or not bundled
        // At all: either way the frame sits in the config's own directory.
        return dirname(file);
    }
    return nearestHolding(bundled) ?? process.cwd();
}

/** Is this specifier installed here? An absent optional peer is simply not pre-bundled. */
function resolves(specifier: string): boolean {
    try {
        requireFrom.resolve(specifier);
        return true;
    } catch {
        return false;
    }
}

/**
 * Serve msw's worker script from the package's OWN install, at the path the
 * worker asks for, with the scope header a worker registered at `/` needs.
 *
 * `@vitest/browser` resolves `/mockServiceWorker.js` too, but from ITS own
 * directory — and it does not depend on `msw`, so that resolution only lands
 * where the installer hoists. The package that OWNS the dependency is the one
 * that can always find it, and it is this one. Without either, a consumer runs
 * `msw init` and declares `msw`, which F8 forbids.
 */
function mswWorkerPlugin(): Plugin {
    return {
        configureServer(server) {
            const script = requireFrom.resolve('msw/mockServiceWorker.js');
            server.middlewares.use('/mockServiceWorker.js', (_request, response) => {
                response.setHeader('content-type', 'text/javascript');
                response.setHeader('service-worker-allowed', '/');
                response.end(readFileSync(script, 'utf8'));
            });
        },
        name: '@jterrazz/test:msw-worker',
    };
}

/**
 * Keep an app's Vite PIPELINE and drop everything that says where the app
 * lives.
 *
 * An allow-list, not a drop-list: a consumer's config carries keys the
 * framework has never heard of — `environments`, `ssr`, `appType`, `publicDir`
 * — and one of them re-roots the run and the project collects nothing. Naming
 * what the pipeline IS keeps an unknown key from leaking in. The consumer's
 * `plugins` are CONCATENATED after the seam's, never assigned over them.
 */
async function reroot(
    source: NonNullable<ComponentProjectOptions['vite']>,
    root: string,
): Promise<Record<string, unknown>> {
    const environment = { command: 'serve', isSsrBuild: false, mode: 'test' } as const;
    let loaded: undefined | UserConfig;
    let from = 'the value it was given';
    if (typeof source === 'string') {
        const { loadConfigFromFile } = await import('vite');
        // Absolute before it is handed over: `loadConfigFromFile` resolves a
        // Relative path against the CWD, which is the tool's, not the config's.
        from = isAbsolute(source) ? source : resolve(root, source);
        const file = await loadConfigFromFile(environment, from);
        loaded = file?.config;
    } else if (typeof source === 'function') {
        loaded = await source(environment);
    } else {
        loaded = await source;
    }
    if (loaded === undefined) {
        throw new Error(`component({ vite }): no config at ${from}`);
    }

    const inactive = transformKey() === 'oxc' ? 'esbuild' : 'oxc';
    const kept: Record<string, unknown> = {};
    const config: Record<string, unknown> = { ...loaded };
    for (const key of PIPELINE_KEYS) {
        if (config[key] !== undefined && key !== inactive) {
            kept[key] = config[key];
        }
    }
    return kept;
}

/** What a missing optional peer costs, said once rather than as a resolver stack. */
const PROVIDER_MISSING =
    'component(): @vitest/browser-playwright is an optional peer — install it beside the runner ' +
    'it pins (npm i -D @vitest/browser-playwright@<the installed vitest version> playwright).';

/** The installed version of a package, read from its own manifest. */
function versionOf(specifier: string): string {
    const manifest: unknown = JSON.parse(
        readFileSync(requireFrom.resolve(`${specifier}/package.json`), 'utf8'),
    );
    if (typeof manifest === 'object' && manifest !== null && 'version' in manifest) {
        return String(manifest.version);
    }
    throw new Error(`component(): ${specifier} is installed without a version.`);
}

/**
 * Which of the two transformer keys the INSTALLED Vite actually reads.
 *
 * Vite 8 transforms with oxc and prints a warning for every `esbuild` option it
 * is handed; Vite 6 and 7 transform with esbuild and have no `oxc` key at all.
 * The inactive one is dropped rather than carried as a second, ignored
 * statement — a config that says the same thing twice is a config that will one
 * day say two different things.
 */
function transformKey(): 'esbuild' | 'oxc' {
    return Number.parseInt(versionOf('vite').split('.')[0] ?? '', 10) >= 8 ? 'oxc' : 'esbuild';
}

/**
 * The JSX default, on the key the running Vite reads, yielding to the
 * consumer's own: a `jsxImportSource` or a classic runtime is the app's
 * statement, not the seam's to overwrite.
 */
function jsxPipeline(pipeline: Record<string, unknown>): Record<string, unknown> {
    const key = transformKey();
    const stated = pipeline[key];
    if (key === 'oxc') {
        return { oxc: stated ?? { jsx: { runtime: 'automatic' } } };
    }
    return { esbuild: stated ?? { jsx: 'automatic' } };
}

/**
 * `@vitest/browser-playwright` peers vitest on an EXACT version: 4.1.10 wants
 * 4.1.10, not `^4.1`. A mismatch fails deep inside the tester with a message
 * about a missing runner, so the pair is checked where the project is built
 * and both versions are named.
 */
function assertProviderPin(): void {
    const runner = versionOf('vitest');
    let provider: string;
    try {
        provider = versionOf('@vitest/browser-playwright');
    } catch {
        throw new Error(PROVIDER_MISSING);
    }
    if (runner !== provider) {
        throw new Error(
            `component(): @vitest/browser-playwright@${provider} peers vitest on an exact version, and vitest is ${runner}. ` +
                `Bump both to the same version in one change (npm i -D vitest@${provider} @vitest/browser-playwright@${provider}).`,
        );
    }
}

/** The framework's own update flag, read where `process` exists. */
function updating(): boolean {
    return (
        process.env.TEST_UPDATE === '1' ||
        process.argv.includes('-u') ||
        process.argv.includes('--update')
    );
}

/**
 * Hand the project's `wrap` to the page as a STATIC import.
 *
 * The page could fetch the module by URL when the first render needs it, and
 * that is what breaks: a dependency Vite never scanned is discovered mid-run,
 * the optimizer rewrites its cache, and every module the page is holding —
 * the test's own included — 404s behind a stale `?v=` hash. A setup file is in
 * the graph before the first test runs, so the wrap and everything it imports
 * are scanned, pre-bundled, and never re-optimised under the run.
 *
 * It is written into `.artifacts/` rather than served from memory because
 * vitest resolves `setupFiles` as paths on disk; it is generated, so it belongs
 * with everything else a tool generates, and never on the row.
 *
 * The wrapper lands on `globalThis` under a shared symbol rather than an
 * export: the setup module and the package's browser build are separate graphs
 * in the page and share no module instance.
 */
function writeSetupFile(wrap: string, root: string): string {
    const absolute = resolve(root, wrap);
    const path = resolve(root, VITEST_ARTIFACTS_DIR, 'component-setup.mjs');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
        path,
        [
            '// Generated by `component({ wrap })` — @jterrazz/test. Do not edit.',
            `import wrap from ${JSON.stringify(absolute)};`,
            "globalThis[Symbol.for('@jterrazz/test:component-wrap')] = wrap;",
            '',
        ].join('\n'),
        'utf8',
    );
    return path;
}

/**
 * What the page cannot read for itself: update mode is a `process.env`/`argv`
 * read, and the project's clock is stated where `process` exists.
 */
function providedToPage(options: ComponentProjectOptions): {
    componentClock?: string;
    componentViewport: { height: number; width: number };
    update: boolean;
} {
    return {
        ...(options.clock === undefined ? {} : { componentClock: options.clock }),
        componentViewport: viewportOf(options),
        update: updating(),
    };
}

/** The page size every render of the project starts at. */
function viewportOf(options: ComponentProjectOptions): { height: number; width: number } {
    return options.viewport ?? { height: 720, width: 1280 };
}

/** The globs a component project collects, and the ones it stays out of. */
function componentGlobs(options: ComponentProjectOptions): {
    exclude: string[];
    include: string[];
} {
    return {
        exclude: options.exclude ?? (options.include === undefined ? ['specs/**'] : []),
        include: options.include ?? ['**/*.test.tsx'],
    };
}

/**
 * A component test renders in a real Chromium — the browser the website facet
 * already drives through the same `playwright` peer.
 *
 * The default `include` reaches the whole project, so the default `exclude`
 * keeps it out of `specs/`, where the assembled product is specified. State
 * your own `include` and the exclusion is yours to state too.
 */
export async function component(
    options: ComponentProjectOptions = {},
): Promise<TestProjectInlineConfiguration> {
    // Read before the first `await`: the caller's frame is only on the stack
    // While the helper's own synchronous body is running.
    const root = options.root ?? callerDirectory();
    assertProviderPin();
    const { playwright } = await import('@vitest/browser-playwright');
    const pipeline = options.vite === undefined ? {} : await reroot(options.vite, root);
    const consumerPlugins = Array.isArray(pipeline.plugins) ? pipeline.plugins : [];

    const project = {
        ...pipeline,
        ...jsxPipeline(pipeline),
        // A cold Vite cache optimises dependencies DURING the first run and
        // Reloads the tester mid-flight ("Vitest failed to find the runner").
        // A fresh CI checkout is exactly that state, so the seam's own runtime
        // Is declared up front. An optional peer that is absent is skipped.
        optimizeDeps: { include: SEAM_DEPENDENCIES.filter(resolves) },
        plugins: [mswWorkerPlugin(), ...consumerPlugins],
        test: {
            browser: {
                commands: COMPONENT_COMMANDS,
                enabled: true,
                // A reference screenshot is a golden, and it has its own option
                // In Vitest 5 — separate from the failure screenshot below,
                // Which is a diagnostic. Both are artefacts, so both are moved.
                expect: { toMatchScreenshot: { screenshotDirectory: SCREENSHOTS_DIR } },
                headless: true,
                instances: [{ browser: 'chromium' }],
                provider: playwright({
                    contextOptions: {
                        locale: options.locale ?? 'en-US',
                        timezoneId: options.timezone ?? 'UTC',
                    },
                }),
                // Browser Mode drops a failure screenshot beside the test by
                // Default; it is an artefact and belongs under `.artifacts/<tool>/`.
                screenshotDirectory: SCREENSHOTS_DIR,
                viewport: viewportOf(options),
            },
            ...componentGlobs(options),
            ...(options.serial === true ? { fileParallelism: false } : {}),
            name: 'component',
            // `shouldUpdateSnapshots()` reads process.env/argv, which a page
            // Does not have, and a wrap module is imported by URL there: both
            // Cross the seam as provided values.
            provide: providedToPage(options),
            ...(options.wrap === undefined
                ? {}
                : { setupFiles: [writeSetupFile(options.wrap, root)] }),
            // Two Chromiums must never share a slot on a 2-vCPU runner: node
            // Projects run first (0), the website facet next (1), this one last.
            sequence: { groupOrder: 2 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    };
    return mergeConfig(projectDefaults(), project) as TestProjectInlineConfiguration;
}
