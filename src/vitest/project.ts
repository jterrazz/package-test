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

// hazard: Chromium aborts every request in flight when the host's addresses change, and a container's start or stop changes them (its veth gains or loses an address), so the component pages run before any project that may start a container, never beside one.
// invariant: the one place a project's group is set: the kinds that start no container share the first groups, the kinds that may start one run after them, and on each side a serial project runs after the parallel ones, since vitest refuses one group of two worker counts.
const STARTS_NO_CONTAINER: ReadonlySet<string> = new Set(['component', 'lint', 'unit']);

const GROUP = {
    containerFree: { parallel: 0, serial: 1 },
    containers: { parallel: 2, serial: 3 },
} as const;

function groupOf(name: string, serial: boolean): number {
    const side = STARTS_NO_CONTAINER.has(name) ? GROUP.containerFree : GROUP.containers;
    return serial ? side.serial : side.parallel;
}

/** A stated `include` or `exclude` replaces the canonical one; a kind that starts no container runs before every kind that may, and a serial project after the parallel ones of its side. */
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
        sequence: { groupOrder: groupOf(name, options.serial === true) },
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

/** What a specification whose spec files import their runner from its specification modules accepts on top. */
export type RunnerOption = {
    /** The `*.specification.ts` modules its spec files import their runner from: stated, a worker's files share one module graph and each module runs again before each file, so every file still boots its own subject. */
    runner?: readonly string[] | string;
};

/** The modules a stated runner names, one or several. */
export const runnersOf = (runner: readonly string[] | string): string[] =>
    typeof runner === 'string' ? [runner] : [...runner];

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
              test: { isolate: false, setupFiles: runnersOf(options.runner) },
          }) as TestProjectInlineConfiguration);
}
