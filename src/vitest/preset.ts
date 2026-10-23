import { GROUND_GLOB, slotsFor } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';
import type {
    TestProjectConfiguration,
    TestProjectInlineConfiguration,
    ViteUserConfig,
} from 'vitest/config';

import {
    BLOB_DIR,
    COVERAGE_DIR,
    MODULE_CACHE_DIR,
    NODE_COMPILE_CACHE_DIR,
    REPORTER_OUTPUT_FILES,
} from '../../lint/kit/project/artifacts.js';
import { isRecord } from '../../lint/kit/project/json-shape.js';
import { EXCLUDE, onProjectDefaults, projectDefaults, statedOnce } from './project.js';

// invariant: `json-summary` is the machine-readable report beside `text` and `html`; coverage is a report, not a gate; the v8 provider is an optional peer.
const COVERAGE = {
    exclude: [
        // outside: browser Mode instruments the page's bundle: without this, react-dom alone buries the project's own number.
        '**/node_modules/**',
        'specs/**',
        GROUND_GLOB,
        '**/*.d.ts',
        '**/*.test-d.ts',
        '**/*.fixtures.ts',
        '.artifacts/**',
        '**/*.config.ts',
        '**/*.config.mts',
    ],
    autoAttachSubprocess: true,
    excludeAfterRemap: true,
    provider: 'v8' as const,
    reporter: ['text', 'html', 'json-summary'],
    reportsDirectory: COVERAGE_DIR,
};

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

export function reporterOutputFiles(argv: readonly string[]): Record<string, string> {
    const shard = shardOf(argv);
    return shard === undefined
        ? REPORTER_OUTPUT_FILES
        : { ...REPORTER_OUTPUT_FILES, blob: `${BLOB_DIR}/blob-${shard.replace('/', '-')}.json` };
}

// invariant: vitest hands the root `env` to every worker it forks, and a worker to every process it spawns; the path is absolute, since a spawned command runs in its own folder. Vitest drops it under v8 coverage, whose source positions a compile-cached script lacks.
// invariant: vitest resolves the module cache against the run's root, so each member of a monorepo keeps its own and two running at once never rewrite one folder.
// invariant: the workers are the toolchain's capacity model's, so a run shares the machine with the gates beside it, and one inside a gate's slice (`TYPESCRIPT_CAPACITY`) stays in it.
function rootDefaults(): ViteUserConfig {
    return mergeConfig(projectDefaults(), {
        test: {
            coverage: COVERAGE,
            env: { NODE_COMPILE_CACHE: resolve(NODE_COMPILE_CACHE_DIR) },
            fsModuleCachePath: MODULE_CACHE_DIR,
            maxWorkers: slotsFor(resolve('.'), 'vitest'),
            outputFile: reporterOutputFiles(process.argv),
        },
    }) as ViteUserConfig;
}

// invariant: a project named by a glob, a promise or a function carries a config this call never saw.
function isInline(project: TestProjectConfiguration): project is TestProjectInlineConfiguration {
    return isRecord(project) && !('then' in project);
}

// outside: Vitest concatenates the root `exclude` into each project, so the preset's own are dropped here; the consumer's stay.
function rootExcludeBeside(projects: TestProjectConfiguration[], exclude: string[]): string[] {
    return projects.every(isInline) ? exclude.filter((glob) => !EXCLUDE.includes(glob)) : exclude;
}

// outside: Vitest resolves each project as its own config: nothing is inherited from the root `test` block.
// outside: a project with its own Vite server evaluates the config file again, and each evaluation reads the capacity as it is then; vitest refuses one group of two worker counts, so every project states the root's one read.
function withProjectDefaults(
    project: TestProjectConfiguration,
    maxWorkers: number | string | undefined,
): TestProjectConfiguration {
    return isInline(project)
        ? (mergeConfig(
              { test: { maxWorkers } },
              onProjectDefaults(project),
          ) as TestProjectInlineConfiguration)
        : project;
}

export function presetConfig(stated: ViteUserConfig = {}): ViteUserConfig {
    const merged = mergeConfig(rootDefaults(), stated) as ViteUserConfig;
    const root = statedOnce(merged.test ?? {});
    const { projects } = root;
    if (projects === undefined) {
        return { ...merged, test: root };
    }

    const inline = projects.map((project): TestProjectConfiguration =>
        withProjectDefaults(project, root.maxWorkers),
    );
    return {
        ...merged,
        test: {
            ...root,
            // Stryker disable next-line ConditionalExpression: the preset's defaults always state an exclude
            ...(root.exclude === undefined
                ? {}
                : { exclude: rootExcludeBeside(inline, root.exclude) }),
            projects: inline,
        },
    };
}
