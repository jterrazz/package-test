import { configDefaults, mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { inPlaceSetup } from '../expectations/in-place/in-place-setup.js';
import { ATTACHMENTS_DIR, VITEST_ARTIFACTS_DIR } from '../kernel/files/artifacts.js';
import { tempRootSetup } from '../kernel/files/temp-root.js';

/**
 * A run's budget. Vitest's own 5s test / 10s hook defaults were raised by every
 * repository that starts real infrastructure, and none of them meant 5s — a
 * container boot, a `prisma db push` or a `next build` all outlive it. 30s is
 * the value the ecosystem's configs already converged on; a suite that needs
 * more (a simulator cold boot, a real image build) states its own per project.
 */
export const TEST_TIMEOUT_MS = 30_000;
export const HOOK_TIMEOUT_MS = 30_000;

/**
 * What a spec STANDS ON is never itself a test: the four ground folders hold
 * inputs and goldens — deliberately-wrong twins, fixture projects a spec lints —
 * and collecting them runs a repository's own counter-examples as if they were
 * its suite. The names are ground wherever a test stands on a file — beside a
 * module under `src/` as much as under `specs/` — which is the glob the
 * toolchain ignores too. Every config that ever hit it added the same line by
 * hand.
 *
 * Merged, not replaced: vite concatenates arrays, so a consumer's `exclude`
 * ADDS to this list and never has to spread `configDefaults.exclude` again.
 */
export const EXCLUDE = [...configDefaults.exclude, '**/{fixtures,expected,seeds,requests}/**'];

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
export const HYGIENE = {
    restoreMocks: true,
    retry: 0,
    unstubEnvs: true,
    unstubGlobals: true,
} as const;

/**
 * Defaults a vitest PROJECT accepts. `coverage` and `reporters` are root-only
 * options (vitest omits them from a project's config), so they are absent here
 * on purpose — setting them would be silently dropped.
 */
function projectDefaults(): TestProjectInlineConfiguration {
    return {
        cacheDir: VITEST_ARTIFACTS_DIR,
        test: {
            attachmentsDir: ATTACHMENTS_DIR,
            exclude: EXCLUDE,
            globalSetup: [inPlaceSetup(), tempRootSetup()],
            hookTimeout: HOOK_TIMEOUT_MS,
            ...HYGIENE,
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
export function statedOnce<T extends { exclude?: string[]; include?: string[] }>(test: T): T {
    const exclude = eachOnce(test.exclude);
    const include = eachOnce(test.include);
    return {
        ...test,
        ...(exclude === undefined ? {} : { exclude }),
        ...(include === undefined ? {} : { include }),
    };
}

/**
 * Build a project ON the defaults — the ONE way a project is built here. The
 * project helpers build their canonical project through this rather than
 * beside it: a helper's project must carry the same budgets and the same
 * artefact directory as a hand-written one.
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
 * The node facets' canonical projects.
 *
 * Each one collects the facet's own tree — `specs/<facet>/**\/*.spec.ts`, the
 * suffix that says "the assembled product" — carries the preset's budgets and
 * artefact directory, and runs in group 0 — the browser facets follow, so two
 * Chromiums never share a slot on a two-vCPU runner. `{ include, exclude,
 * timeout, serial }` is what a repository states when its tree, its budget or
 * its parallelism differs;
 * everything else is the framework's.
 */

/** What every helper accepts on top of its canonical project. */
export type FacetProjectOptions = {
    /**
     * Globs this project stays out of. On a facet helper they ADD to the
     * preset's (`fixtures/` and vitest's own), because vite concatenates. On
     * `unit()` and `component()`, whose canonical `exclude` exists only to
     * guard their canonical `include`, stating one replaces it — so state
     * both or neither there.
     */
    exclude?: string[];
    /** Replace the canonical `include` globs. */
    include?: string[];
    /**
     * Run this project's files ONE AT A TIME (`fileParallelism: false`) — for
     * the facets whose files share something a second worker would collide
     * with: one served app, one database file, one browser profile.
     */
    serial?: boolean;
    /** Raise (or lower) the 30s budget for this project alone. */
    timeout?: number;
};

/** The globs a node facet collects, and the ones a caller stated instead. */
export function facetProject(
    facet: string,
    options: FacetProjectOptions,
): TestProjectInlineConfiguration {
    return onProjectDefaults({
        test: {
            ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
            include: options.include ?? [`specs/${facet}/**/*.spec.ts`],
            ...(options.serial === true ? { fileParallelism: false } : {}),
            name: facet,
            sequence: { groupOrder: 0 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    });
}
