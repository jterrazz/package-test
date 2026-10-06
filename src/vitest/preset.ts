import { GROUND_GLOB } from '@jterrazz/typescript/rules';
import { mergeConfig } from 'vitest/config';
import type {
    TestProjectConfiguration,
    TestProjectInlineConfiguration,
    ViteUserConfig,
} from 'vitest/config';

import { BLOB_DIR, COVERAGE_DIR, REPORTER_OUTPUT_FILES } from '../../lint/kit/project/artifacts.js';
import { isRecord } from '../../lint/kit/project/json-shape.js';
import { EXCLUDE, onProjectDefaults, projectDefaults, statedOnce } from './project.js';

/** `json-summary` is the machine-readable report beside `text` and `html` — coverage is a report, not a gate; the v8 provider is an optional peer. */
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

function rootDefaults(): ViteUserConfig {
    return mergeConfig(projectDefaults(), {
        test: { coverage: COVERAGE, outputFile: reporterOutputFiles(process.argv) },
    }) as ViteUserConfig;
}

/** A project named by a glob, a promise or a function carries a config this call never saw. */
function isInline(project: TestProjectConfiguration): project is TestProjectInlineConfiguration {
    return isRecord(project) && !('then' in project);
}

/** Vitest concatenates the root `exclude` into each project, so the preset's own are dropped here; the consumer's stay. */
function rootExcludeBeside(projects: TestProjectConfiguration[], exclude: string[]): string[] {
    return projects.every(isInline) ? exclude.filter((glob) => !EXCLUDE.includes(glob)) : exclude;
}

/** Vitest resolves each project as its own config: nothing is inherited from the root `test` block. */
function withProjectDefaults(project: TestProjectConfiguration): TestProjectConfiguration {
    return isInline(project) ? onProjectDefaults(project) : project;
}

export function presetConfig(stated: ViteUserConfig = {}): ViteUserConfig {
    const merged = mergeConfig(rootDefaults(), stated) as ViteUserConfig;
    const root = statedOnce(merged.test ?? {});
    const { projects } = root;
    if (projects === undefined) {
        return { ...merged, test: root };
    }

    const inline = projects.map(withProjectDefaults);
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
