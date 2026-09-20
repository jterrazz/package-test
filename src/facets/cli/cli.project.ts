import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';
import { literate } from '../../runner/literate-plugin.js';
import type { LiterateOptions } from '../../runner/literate-plugin.js';

/** `cli()` — a binary, and the documents that specify it. */
export type CliProjectOptions = FacetProjectOptions & {
    /**
     * The literate door, wired by default: every `specs/cli/**\/*.spec.yaml`
     * becomes a test file bound to `specs/cli/cli.specification.ts`. State
     * `specification` to name another runner, `include` to narrow the glob, or
     * `false` to collect no documents at all.
     */
    literate?: false | Partial<LiterateOptions>;
};

/** The literate defaults — the path convention `cli()` assumes when nothing says otherwise. */
const CLI_SPECIFICATION = './specs/cli/cli.specification.ts';
const CLI_DOCUMENTS = ['specs/cli/**/*.spec.yaml'];

/**
 * A cli project collects the facet's `.test.ts` files AND its documents: a
 * `<case>.spec.yaml` is a test file of its own (docs/07 § the literate door),
 * so the plugin's glob has to join the include of the project that collects
 * them — which is this one, never the root config.
 */
export function cli(options: CliProjectOptions = {}): TestProjectInlineConfiguration {
    const { literate: literateOptions, ...common } = options;
    const project = facetProject('cli', common);
    if (literateOptions === false) {
        return project;
    }
    const documents = literateOptions?.include ?? CLI_DOCUMENTS;
    return mergeConfig(project, {
        plugins: [
            literate({
                include: documents,
                specification: literateOptions?.specification ?? CLI_SPECIFICATION,
            }),
        ],
    }) as TestProjectInlineConfiguration;
}
