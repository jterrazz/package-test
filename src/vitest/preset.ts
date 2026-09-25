import { mergeConfig } from 'vitest/config';
import type { TestProjectConfiguration, ViteUserConfig } from 'vitest/config';

import { literate } from '../facets/cli/cli.project.js';
import type { LiterateOptions } from '../facets/cli/cli.project.js';
import { BLOB_DIR, COVERAGE_DIR, REPORTER_OUTPUT_FILES } from '../kernel/files/artifacts.js';
import { GROUND_GLOB } from '../kernel/files/ground.js';
import { EXCLUDE, onProjectDefaults, projectDefaults, statedOnce } from './project-kit.js';

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
        // project's own number disappears under its dependencies.
        '**/node_modules/**',
        // A spec is a test, and the fixture app a spec drives is ground —
        // beside a module as much as under `specs/`.
        'specs/**',
        GROUND_GLOB,
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

/** The shard a run was started for, `<index>/<count>`, read off its arguments. */
function shardOf(argv: readonly string[]): string | undefined {
    for (const [index, argument] of argv.entries()) {
        if (argument.startsWith('--shard=')) {
            return argument.slice('--shard='.length);
        }
        if (argument === '--shard') {
            return argv[index + 1];
        }
    }
    return undefined;
}

/**
 * What each file-writing reporter writes, the blob named for the run's shard:
 * the shards of one run write side by side under one folder, which is what
 * `vitest --merge-reports` reads back as one run.
 *
 * @internal
 */
export function reporterOutputFiles(argv: readonly string[]): Record<string, string> {
    const shard = shardOf(argv);
    return shard === undefined
        ? REPORTER_OUTPUT_FILES
        : { ...REPORTER_OUTPUT_FILES, blob: `${BLOB_DIR}/blob-${shard.replace('/', '-')}.json` };
}

/** Defaults for the root config — the project ones, plus what only a root carries. */
function rootDefaults(): ViteUserConfig {
    return mergeConfig(projectDefaults(), {
        test: { coverage: COVERAGE, outputFile: reporterOutputFiles(process.argv) },
    }) as ViteUserConfig;
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
