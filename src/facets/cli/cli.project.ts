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
    /** Every `specs/<facet>/` `.spec.yaml` becomes a test bound to `specs/<facet>/<facet>.specification.ts`; `false` collects none. */
    literate?: false | Partial<LiterateOptions>;
};

/** The plugin's glob joins the include of the collecting project, never the root config. */
function documentProject(
    facet: string,
    options: FacetProjectOptions & LiterateDoor,
): TestProjectInlineConfiguration {
    const { literate: door, ...common } = options;
    const project = facetProject(facet, common);
    if (door === false) {
        return project;
    }
    return mergeConfig(project, {
        plugins: [
            literate({
                include: door?.include ?? [`specs/${facet}/**/*.spec.yaml`],
                specification: door?.specification ?? `./specs/${facet}/${facet}.specification.ts`,
            }),
        ],
    }) as TestProjectInlineConfiguration;
}

/** `cli()` — a binary, and the documents that specify it. */
export type CliProjectOptions = FacetProjectOptions & LiterateDoor;

/** A cli project: the facet's `.spec.ts` files and its documents (docs/20). */
export function cli(options: CliProjectOptions = {}): TestProjectInlineConfiguration {
    return documentProject('cli', options);
}
