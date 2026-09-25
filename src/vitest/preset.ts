import { mergeConfig } from 'vitest/config';
import type { TestProjectConfiguration, ViteUserConfig } from 'vitest/config';

import { literate } from '../facets/cli/cli.project.js';
import type { LiterateOptions } from '../facets/cli/cli.project.js';
import { BLOB_DIR, COVERAGE_DIR, REPORTER_OUTPUT_FILES } from '../kernel/files/artifacts.js';
import { GROUND_GLOB } from '../kernel/files/ground.js';
import { EXCLUDE, onProjectDefaults, projectDefaults, statedOnce } from './project-kit.js';

/** A vite/vitest config, merged over the preset's defaults, plus `literate`. */
export type SpecConfig = ViteUserConfig & {
    /** Turns matching `<case>.spec.yaml` files into tests; with `projects`, put the plugin in the collecting project instead. */
    literate?: LiterateOptions;
};

/** `json-summary` is what the coverage ratchet reads; the v8 provider is an optional peer. */
const COVERAGE = {
    exclude: [
        // Browser Mode instruments the page's bundle: without this, react-dom alone buries the project's own number.
        '**/node_modules/**',
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

function rootDefaults(): ViteUserConfig {
    return mergeConfig(projectDefaults(), {
        test: { coverage: COVERAGE, outputFile: reporterOutputFiles(process.argv) },
    }) as ViteUserConfig;
}

/** A project named by a glob or a promise carries a config this call never saw. */
function allInline(projects: TestProjectConfiguration[]): boolean {
    return projects.every(
        (project) => typeof project === 'object' && project !== null && !('then' in project),
    );
}

/** Vitest concatenates the root `exclude` into each project, so the preset's own are dropped here; the consumer's stay. */
function rootExcludeBeside(projects: TestProjectConfiguration[], exclude: string[]): string[] {
    return allInline(projects) ? exclude.filter((glob) => !EXCLUDE.includes(glob)) : exclude;
}

/** Vitest resolves each project as its own config: nothing is inherited from the root `test` block. */
function withProjectDefaults(project: TestProjectConfiguration): TestProjectConfiguration {
    if (typeof project !== 'object' || project === null || 'then' in project) {
        return project;
    }
    return onProjectDefaults(project);
}

/** The shared vitest config: what you pass is merged over the defaults. */
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
