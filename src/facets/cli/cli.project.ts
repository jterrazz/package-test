import type { TestProjectInlineConfiguration } from 'vitest/config';

import { documentProject } from '../../vitest/facet-project.js';
import type { FacetProjectOptions, LiterateDoor } from '../../vitest/facet-project.js';

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
