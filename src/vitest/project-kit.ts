import { configDefaults, mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { inPlaceSetup } from '../expectations/in-place/in-place-setup.js';
import { ATTACHMENTS_DIR, VITEST_ARTIFACTS_DIR } from '../kernel/files/artifacts.js';
import { GROUND_GLOB } from '../kernel/files/ground.js';
import { tempRootSetup } from '../kernel/files/temp-root.js';

/** Vitest's 5s default is outlived by a container boot or a `next build`; 30s is what the ecosystem converged on. */
export const TEST_TIMEOUT_MS = 30_000;
export const HOOK_TIMEOUT_MS = 30_000;

/** Ground folders hold inputs and deliberately-wrong twins, never tests; vite concatenates, so a consumer's `exclude` adds to this. */
export const EXCLUDE = [...configDefaults.exclude, GROUND_GLOB];

/** `retry: 0`: a flaky test is fixed or deleted, never re-rolled. The restores let `vi.stubEnv()` go without an `afterEach` (`given-in-the-test`). */
export const HYGIENE = {
    restoreMocks: true,
    retry: 0,
    unstubEnvs: true,
    unstubGlobals: true,
} as const;

/** `coverage` and `reporters` are root-only: vitest drops them from a project. */
export function projectDefaults(): TestProjectInlineConfiguration {
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

function eachOnce(globs: string[] | undefined): string[] | undefined {
    return globs === undefined ? undefined : [...new Set(globs)];
}

/** Vite concatenates these lists: each glob is kept once. */
export function statedOnce<T extends { exclude?: string[]; include?: string[] }>(test: T): T {
    const exclude = eachOnce(test.exclude);
    const include = eachOnce(test.include);
    return {
        ...test,
        ...(exclude === undefined ? {} : { exclude }),
        ...(include === undefined ? {} : { include }),
    };
}

export function onProjectDefaults(
    stated: TestProjectInlineConfiguration,
): TestProjectInlineConfiguration {
    const merged = mergeConfig(projectDefaults(), stated) as TestProjectInlineConfiguration;
    return merged.test === undefined ? merged : { ...merged, test: statedOnce(merged.test) };
}

/** What every helper accepts on top of its canonical project. */
export type FacetProjectOptions = {
    /** Globs to stay out of: added to the preset's on a facet helper, replacing the canonical ones on `unit()` and `component()`. */
    exclude?: string[];
    /** Replace the canonical `include` globs. */
    include?: string[];
    /** Run files one at a time, for facets sharing a served app, a database file or a browser profile. */
    serial?: boolean;
    /** Raise (or lower) the 30s budget for this project alone. */
    timeout?: number;
};

/** Group 0: the browser facets follow, so two Chromiums never share a slot on a two-vCPU runner. */
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
