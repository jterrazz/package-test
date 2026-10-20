import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { runnerProject } from '../../vitest/project.js';
import type { RunnerOption, SpecificationProjectOptions } from '../../vitest/project.js';
import { literate } from './documents/literate-plugin.js';
import type { LiterateOptions } from './documents/literate-plugin.js';

export {
    literate,
    type LiterateOptions,
    type LiteratePlugin,
} from './documents/literate-plugin.js';

/** The literate door of the specification that reads documents: the cli. */
export type LiterateDoor = {
    /** Every `specs/cli/` `.spec.yaml` becomes a test bound to `specs/cli/cli.specification.ts`; `false` collects none. */
    literate?: false | Partial<LiterateOptions>;
};

/** `cli()`: a binary, and the documents that specify it. */
export type CliProjectOptions = LiterateDoor & RunnerOption & SpecificationProjectOptions;

// invariant: a document imports the module its door names, which the shared graph runs again before each file only when it is the project's runner.
function runnerBeside(
    common: RunnerOption & SpecificationProjectOptions,
    documents: string,
): RunnerOption & SpecificationProjectOptions {
    const { runner, ...isolated } = common;
    return runner !== undefined && resolve(runner) === resolve(documents) ? common : isolated;
}

/** A cli project: the specification's `.spec.ts` files and its documents (docs/guides/spec-documents.md); the plugin's glob joins this project's include, never the root config. */
export function cli(options: CliProjectOptions = {}): TestProjectInlineConfiguration {
    const { literate: door, ...common } = options;
    if (door === false) {
        return runnerProject('cli', common);
    }
    const documents = door?.runner ?? './specs/cli/cli.specification.ts';
    return mergeConfig(runnerProject('cli', runnerBeside(common, documents)), {
        plugins: [
            literate({
                include: door?.include ?? ['specs/cli/**/*.spec.yaml'],
                runner: documents,
            }),
        ],
    }) as TestProjectInlineConfiguration;
}
