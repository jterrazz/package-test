import {
    configDefaults,
    mergeConfig,
    type TestProjectConfiguration,
    type TestProjectInlineConfiguration,
    type ViteUserConfig,
} from 'vitest/config';

import { COVERAGE_DIR, VITEST_ARTIFACTS_DIR } from '../core/artifacts/artifacts.js';
import { literate, type LiterateOptions } from './literate-plugin.js';

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
 * Options are a vite/vitest config plus one key of the framework's own.
 * Everything stated here wins over the preset's defaults.
 */
export interface SpecConfig extends ViteUserConfig {
    /**
     * Turns every matching `<case>.spec.yaml` into a test file bound to the
     * named specification — the {@link literate} plugin, added to `plugins`.
     *
     * Declare it here for a config with no `projects`. With projects, the glob
     * has to join the include of the ONE project that collects those documents,
     * so the plugin goes in that project's own `plugins` instead.
     */
    literate?: LiterateOptions;
}

/**
 * Defaults a vitest PROJECT accepts. `coverage` and `reporters` are root-only
 * options (vitest omits them from a project's config), so they are absent here
 * on purpose — setting them would be silently dropped.
 */
function projectDefaults(): TestProjectInlineConfiguration {
    return {
        cacheDir: VITEST_ARTIFACTS_DIR,
        test: {
            exclude: EXCLUDE,
            hookTimeout: HOOK_TIMEOUT_MS,
            testTimeout: TEST_TIMEOUT_MS,
        },
    };
}

/** Defaults for the root config — the project ones, plus what only a root carries. */
function rootDefaults(): ViteUserConfig {
    return {
        cacheDir: VITEST_ARTIFACTS_DIR,
        test: {
            coverage: { reportsDirectory: COVERAGE_DIR },
            exclude: EXCLUDE,
            hookTimeout: HOOK_TIMEOUT_MS,
            testTimeout: TEST_TIMEOUT_MS,
        },
    };
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
    return mergeConfig(projectDefaults(), project) as TestProjectConfiguration;
}

export function defineSpecConfig(config: SpecConfig = {}): ViteUserConfig {
    const { literate: literateOptions, ...userConfig } = config;

    const stated = literateOptions
        ? (mergeConfig({ plugins: [literate(literateOptions)] }, userConfig) as ViteUserConfig)
        : (userConfig as ViteUserConfig);

    const merged = mergeConfig(rootDefaults(), stated) as ViteUserConfig;
    const projects = merged.test?.projects;
    if (!projects) {
        return merged;
    }

    return {
        ...merged,
        test: { ...merged.test, projects: projects.map(withProjectDefaults) },
    };
}
