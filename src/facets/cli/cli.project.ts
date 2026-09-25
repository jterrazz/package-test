import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/facet-project.js';
import type { FacetProjectOptions } from '../../vitest/facet-project.js';
import { literate } from './documents/literate-plugin.js';
import type { LiterateOptions } from './documents/literate-plugin.js';

/** The literate door of the facet that reads documents — the cli. */
export type LiterateDoor = {
    /**
     * The door, wired by default: every `specs/<facet>/**\/*.spec.yaml` becomes
     * a test file bound to `specs/<facet>/<facet>.specification.ts`. State
     * `specification` to name another runner, `include` to narrow the glob, or
     * `false` to collect no documents at all.
     */
    literate?: false | Partial<LiterateOptions>;
};

/**
 * A facet project that collects its documents too: a `<case>.spec.yaml` is a
 * test file of its own, so the plugin's glob has to join the include of the
 * project that collects them — never the root config. Called bare, the path
 * convention is assumed: `specs/<facet>/**\/*.spec.yaml`, bound to
 * `./specs/<facet>/<facet>.specification.ts`.
 */
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

/**
 * A cli project collects the facet's `.spec.ts` files AND its documents:
 * `specs/cli/**\/*.spec.yaml`, bound to `specs/cli/cli.specification.ts`
 * unless `literate` says otherwise (docs/12 § the literate door).
 */
export function cli(options: CliProjectOptions = {}): TestProjectInlineConfiguration {
    return documentProject('cli', options);
}
