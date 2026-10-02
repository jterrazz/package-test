import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';
import { literate } from './documents/literate-plugin.js';
import type { LiterateOptions } from './documents/literate-plugin.js';

export {
    literate,
    type LiterateOptions,
    type LiteratePlugin,
} from './documents/literate-plugin.js';

/** The literate door of the facet that reads documents — the cli. */
export type LiterateDoor = {
    /** Every `specs/cli/` `.spec.yaml` becomes a test bound to `specs/cli/cli.specification.ts`; `false` collects none. */
    literate?: false | Partial<LiterateOptions>;
};

/** `cli()` — a binary, and the documents that specify it. */
export type CliProjectOptions = FacetProjectOptions & LiterateDoor;

/** A cli project: the facet's `.spec.ts` files and its documents (docs/15); the plugin's glob joins this project's include, never the root config. */
export function cli(options: CliProjectOptions = {}): TestProjectInlineConfiguration {
    const { literate: door, ...common } = options;
    const project = facetProject('cli', common);
    if (door === false) {
        return project;
    }
    return mergeConfig(project, {
        plugins: [
            literate({
                include: door?.include ?? ['specs/cli/**/*.spec.yaml'],
                specification: door?.specification ?? './specs/cli/cli.specification.ts',
            }),
        ],
    }) as TestProjectInlineConfiguration;
}
