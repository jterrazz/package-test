import { configDefaults, mergeConfig } from 'vitest/config';
import type {
    TestProjectConfiguration,
    TestProjectInlineConfiguration,
    ViteUserConfig,
} from 'vitest/config';

import {
    ATTACHMENTS_DIR,
    COVERAGE_DIR,
    REPORTER_OUTPUT_FILES,
    VITEST_ARTIFACTS_DIR,
} from '../model/artifacts/artifacts.js';
import { literate } from './literate-plugin.js';
import type { LiterateOptions } from './literate-plugin.js';

/**
 * `defineSpecConfig()` — the shared vitest config every repository of the
 * ecosystem starts from.
 *
 * Fourteen hand-rolled `vitest.config.ts` files had converged on the same
 * handful of settings and disagreed on the rest by accident; the preset is
 * their common ground, stated once. A consumer writes ONE call and keeps
 * everything vitest offers: what it passes is a plain vite/vitest config,
 * merged OVER the defaults, so any of them is overridable in place.
 *
 * ```typescript
 * // vitest.config.ts
 * import { defineSpecConfig } from '@jterrazz/test/vitest';
 *
 * export default defineSpecConfig({
 *     literate: { specification: './specs/cli/cli.specification.ts' },
 *     test: {
 *         projects: [
 *             { test: { include: ['src/**\/*.test.ts'], name: 'unit' } },
 *             { test: { include: ['specs/api/**\/*.test.ts'], name: 'api' } },
 *         ],
 *     },
 * });
 * ```
 */

/**
 * A run's budget. Vitest's own 5s test / 10s hook defaults were raised by every
 * repository that starts real infrastructure, and none of them meant 5s — a
 * container boot, a `prisma db push` or a `next build` all outlive it. 30s is
 * the value the ecosystem's configs already converged on; a suite that needs
 * more (a simulator cold boot, a real image build) states its own per project.
 */
const TEST_TIMEOUT_MS = 30_000;
const HOOK_TIMEOUT_MS = 30_000;

/**
 * What a spec STANDS ON is never itself a test: `_fixtures/` holds inputs —
 * deliberately-wrong twins, fixture projects a spec lints — and collecting them
 * runs a repository's own counter-examples as if they were its suite. Every
 * config that ever hit it added the same line by hand.
 *
 * Merged, not replaced: vite concatenates arrays, so a consumer's `exclude`
 * ADDS to this list and never has to spread `configDefaults.exclude` again.
 */
const EXCLUDE = [...configDefaults.exclude, '**/_fixtures/**'];

/**
 * What a test may never carry into the next one, and the one policy the
 * framework states rather than lints.
 *
 * `retry: 0` is the policy: a flaky test is fixed or deleted, never re-rolled
 * until it passes. A retry turns a real defect into a slow one and hides the
 * day it becomes permanent.
 *
 * The three restores are the other half of the same idea. `vi.spyOn`,
 * `vi.stubGlobal` and `vi.stubEnv` each own a teardown, and a test that forgets
 * one leaks into whatever runs next — a failure that appears in a FILE that did
 * nothing wrong and disappears when that file is run alone. Turning them on
 * here is what lets `clock.at()` and `vi.stubEnv()` be written without an
 * `afterEach`, which is the shape rule J6w asks for.
 */
const HYGIENE = {
    restoreMocks: true,
    retry: 0,
    unstubEnvs: true,
    unstubGlobals: true,
} as const;

/**
 * Options are a vite/vitest config plus one key of the framework's own.
 * Everything stated here wins over the preset's defaults.
 */
export type SpecConfig = {
    /**
     * Turns every matching `<case>.spec.yaml` into a test file bound to the
     * named specification — the {@link literate} plugin, added to `plugins`.
     *
     * Declare it here for a config with no `projects`. With projects, the glob
     * has to join the include of the ONE project that collects those documents,
     * so the plugin goes in that project's own `plugins` instead.
     */
    literate?: LiterateOptions;
} & ViteUserConfig;

/**
 * Defaults a vitest PROJECT accepts. `coverage` and `reporters` are root-only
 * options (vitest omits them from a project's config), so they are absent here
 * on purpose — setting them would be silently dropped.
 *
 * Exported for the project helpers, which build their canonical project ON
 * these rather than beside them: a helper's project must carry the same
 * budgets and the same artefact directory as a hand-written one.
 *
 * @internal
 */
export function projectDefaults(): TestProjectInlineConfiguration {
    return {
        cacheDir: VITEST_ARTIFACTS_DIR,
        test: {
            attachmentsDir: ATTACHMENTS_DIR,
            exclude: EXCLUDE,
            hookTimeout: HOOK_TIMEOUT_MS,
            ...HYGIENE,
            testTimeout: TEST_TIMEOUT_MS,
        },
    };
}

/**
 * Coverage, when `--coverage` asks for it.
 *
 * `v8` because it is the runtime's own counter: no instrumentation pass, no
 * second transform of every file, and the numbers do not move when the bundler
 * does. The provider is an OPTIONAL peer (`@vitest/coverage-v8`), so a project
 * that never asks for coverage never installs it.
 *
 * `json-summary` is not a taste: it is the machine-readable report the ratchet
 * reads. `text` is for the human running the command, and `html` for the one
 * chasing a line. All three land under `.artifacts/vitest/coverage/`, the one
 * directory the toolchain's page owns.
 *
 * What is EXCLUDED is the shape of the answer, not a way to raise the number:
 * a type-only module has nothing to execute (v8 reports it as 0/0 or, worse,
 * as uncovered lines that cannot be covered), and the CLI entries are proven
 * by running the binary, not by importing it.
 */
const COVERAGE = {
    exclude: [
        // Browser Mode instruments what the PAGE loaded, which is the bundle:
        // Without this line react-dom alone is 19 000 statements and the
        // Project's own number disappears under its dependencies.
        '**/node_modules/**',
        // A spec is a test, and the fixture app a spec drives is ground.
        'specs/**',
        '**/_fixtures/**',
        '**/*.d.ts',
        '**/*.test-d.ts',
        '**/*.fixtures.ts',
        'dist/**',
        '.artifacts/**',
        '**/*.config.ts',
        '**/*.config.mts',
    ],
    provider: 'v8' as const,
    reporter: ['text', 'html', 'json-summary'],
    reportsDirectory: COVERAGE_DIR,
};

/** Defaults for the root config — the project ones, plus what only a root carries. */
function rootDefaults(): ViteUserConfig {
    return {
        cacheDir: VITEST_ARTIFACTS_DIR,
        test: {
            attachmentsDir: ATTACHMENTS_DIR,
            coverage: COVERAGE,
            exclude: EXCLUDE,
            hookTimeout: HOOK_TIMEOUT_MS,
            ...HYGIENE,
            outputFile: REPORTER_OUTPUT_FILES,
            testTimeout: TEST_TIMEOUT_MS,
        },
    };
}

/** A glob list with its repeats taken out, or nothing where there is no list. */
function eachOnce(globs: string[] | undefined): string[] | undefined {
    return globs === undefined ? undefined : [...new Set(globs)];
}

/**
 * The glob lists vite CONCATENATES rather than overrides, each glob kept once.
 *
 * A project built ON the defaults and then merged INTO them by
 * `defineSpecConfig` carried every default twice. Glob matching is idempotent,
 * so nothing collected differently — but the no-tests banner is the one place a
 * consumer ever reads that list, and it read as three merges of the same three
 * globs.
 */
function statedOnce<T extends { exclude?: string[]; include?: string[] }>(test: T): T {
    const exclude = eachOnce(test.exclude);
    const include = eachOnce(test.include);
    return {
        ...test,
        ...(exclude === undefined ? {} : { exclude }),
        ...(include === undefined ? {} : { include }),
    };
}

/**
 * Build a project ON the defaults — the ONE way a project is built here.
 *
 * @internal
 */
export function onProjectDefaults(
    stated: TestProjectInlineConfiguration,
): TestProjectInlineConfiguration {
    const merged = mergeConfig(projectDefaults(), stated) as TestProjectInlineConfiguration;
    return merged.test === undefined ? merged : { ...merged, test: statedOnce(merged.test) };
}

/**
 * Is every project an inline object — one this preset merged its defaults into?
 * A project named by a glob or handed as a promise carries a config this call
 * never saw, and the root's exclusions are the only ones it gets from here.
 */
function allInline(projects: TestProjectConfiguration[]): boolean {
    return projects.every(
        (project) => typeof project === 'object' && project !== null && !('then' in project),
    );
}

/**
 * The root's exclusions, beside projects that already carry them.
 *
 * With `projects`, the root collects nothing itself: its `exclude` only travels
 * INTO each project, where vitest CONCATENATES it with the project's own — so
 * every preset glob reached the banner twice. The preset's own are dropped
 * here, since each inline project states them in full; what the CONSUMER stated
 * at the root stays, because no project holds a copy of that.
 */
function rootExcludeBeside(projects: TestProjectConfiguration[], exclude: string[]): string[] {
    return allInline(projects) ? exclude.filter((glob) => !EXCLUDE.includes(glob)) : exclude;
}

/**
 * A project inherits NOTHING from the root `test` block — vitest resolves each
 * project as its own config — so the defaults are merged into every inline one.
 * A project declared as a glob string, a promise or a function is handed back
 * untouched: there is no object to merge into.
 */
function withProjectDefaults(project: TestProjectConfiguration): TestProjectConfiguration {
    if (typeof project !== 'object' || project === null || 'then' in project) {
        return project;
    }
    return onProjectDefaults(project);
}

export function defineSpecConfig(config: SpecConfig = {}): ViteUserConfig {
    const { literate: literateOptions, ...userConfig } = config;

    const stated = literateOptions
        ? (mergeConfig({ plugins: [literate(literateOptions)] }, userConfig) as ViteUserConfig)
        : userConfig;

    const merged = mergeConfig(rootDefaults(), stated) as ViteUserConfig;
    const root = merged.test === undefined ? undefined : statedOnce(merged.test);
    if (root === undefined) {
        return merged;
    }
    const { projects } = root;
    if (projects === undefined) {
        return { ...merged, test: root };
    }

    const inline = projects.map(withProjectDefaults);
    return {
        ...merged,
        test: {
            ...root,
            ...(root.exclude === undefined
                ? {}
                : { exclude: rootExcludeBeside(inline, root.exclude) }),
            projects: inline,
        },
    };
}
