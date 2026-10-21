import { GROUND_GLOB } from '@jterrazz/typescript/rules';
import { configDefaults, mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import {
    ARTIFACTS_DIR,
    ATTACHMENTS_DIR,
    VITEST_ARTIFACTS_DIR,
} from '../../lint/kit/project/artifacts.js';
import { tempRootSetup } from '../chain/paths/temp-root.global-setup.js';
import { inPlaceSetup } from '../expectations/in-place/in-place.global-setup.js';

// invariant: vitest's 5s default is outlived by a container boot or a `next build`; 30s is what the ecosystem converged on.
const TEST_TIMEOUT_MS = 30_000;
const HOOK_TIMEOUT_MS = 30_000;

/** Ground folders hold inputs and deliberately-wrong twins, never tests, and `.artifacts/` copies of the project (a mutation sandbox); vite concatenates, so a consumer's `exclude` adds to this. */
export const EXCLUDE = [...configDefaults.exclude, `${ARTIFACTS_DIR}/**`, GROUND_GLOB];

// invariant: `retry: 0`: a flaky test is fixed or deleted, never re-rolled. The restores let `vi.stubEnv()` go without an `afterEach` (`given-in-the-test`).
const HYGIENE = {
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
    // Stryker disable next-line ConditionalExpression: the defaults always state a test block, so the merge always holds one
    return merged.test === undefined ? merged : { ...merged, test: statedOnce(merged.test) };
}

/** What every helper accepts on top of its canonical project. */
export type SpecificationProjectOptions = {
    /** Globs to stay out of: added to the preset's on a specification helper, replacing the canonical ones on `unit()` and `component()`. */
    exclude?: string[];
    /** Replace the canonical `include` globs. */
    include?: string[];
    /** Run files one at a time, for specifications sharing a served app, a database file or a browser profile. */
    serial?: boolean;
    /** Raise (or lower) the 30s budget for this project alone: each test's, and each hook's, which tears down what the test stood on. */
    timeout?: number;
};

type CanonicalGlobs = { exclude?: string[]; include: string[] };

type ProjectTest = NonNullable<TestProjectInlineConfiguration['test']>;

// invariant: the one place a project's group is set: every project runs in group 0, on the one pool of workers the capacity model sizes, a browser project's pages beside the node kinds; a serial one runs after them, in group 1, since vitest refuses one group of two worker counts.
const PARALLEL = { groupOrder: 0 } as const;

const SERIAL = { groupOrder: 1 } as const;

/** A stated `include` or `exclude` replaces the canonical one; a project shares group 0 with every other, a serial one runs after them. */
export function projectTest(
    name: string,
    options: SpecificationProjectOptions,
    canonical: CanonicalGlobs,
): ProjectTest {
    const exclude = options.exclude ?? canonical.exclude;
    return {
        ...(exclude === undefined ? {} : { exclude }),
        include: options.include ?? canonical.include,
        ...(options.serial === true ? { fileParallelism: false } : {}),
        name,
        sequence: options.serial === true ? SERIAL : PARALLEL,
        ...(options.timeout === undefined
            ? {}
            : { hookTimeout: options.timeout, testTimeout: options.timeout }),
    };
}

export function specificationProject(
    specification: string,
    options: SpecificationProjectOptions,
): TestProjectInlineConfiguration {
    return onProjectDefaults({
        test: projectTest(specification, options, {
            include: [`specs/${specification}/**/*.spec.ts`],
        }),
    });
}

/** What a specification whose spec files import their runner from one module accepts on top. */
export type RunnerOption = {
    /** The `*.specification.ts` module its spec files import their runner from: stated, a worker's files share one module graph and the module runs again before each file, so every file still boots its own subject. */
    runner?: string;
};

/** What a specification whose runner boots its subject in this process accepts on top. */
export type InProcessProjectOptions = RunnerOption & SpecificationProjectOptions;

export function runnerProject(
    specification: string,
    options: RunnerOption & SpecificationProjectOptions,
): TestProjectInlineConfiguration {
    const project = specificationProject(specification, options);

    return options.runner === undefined
        ? project
        : (mergeConfig(project, {
              test: { isolate: false, setupFiles: [options.runner] },
          }) as TestProjectInlineConfiguration);
}
