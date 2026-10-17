import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { specificationProject } from '../../vitest/project.js';
import type { SpecificationProjectOptions } from '../../vitest/project.js';
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
export type CliProjectOptions = LiterateDoor & SpecificationProjectOptions;

/** A cli project: the specification's `.spec.ts` files and its documents (docs/guides/spec-documents.md); the plugin's glob joins this project's include, never the root config. */
export function cli(options: CliProjectOptions = {}): TestProjectInlineConfiguration {
    const { literate: door, ...common } = options;
    const project = specificationProject('cli', common);
    if (door === false) {
        return project;
    }
    return mergeConfig(project, {
        plugins: [
            literate({
                include: door?.include ?? ['specs/cli/**/*.spec.yaml'],
                runner: door?.runner ?? './specs/cli/cli.specification.ts',
            }),
        ],
    }) as TestProjectInlineConfiguration;
}
