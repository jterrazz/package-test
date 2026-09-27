import { relative } from 'node:path';

import { facetFoldersOf, specificationsIn, textOf } from '../../engine/project/facet-folders.js';
import type { Spotted } from './checker.js';

export function checkFacetFolderHasSpecification(specsRoot: string): Spotted[] {
    const violations: Spotted[] = [];
    for (const { facet, path } of facetFoldersOf(specsRoot)) {
        const constructs = specificationsIn(path).some((file) =>
            (textOf(file) ?? '').includes(`specification.${facet}(`),
        );
        if (constructs) {
            continue;
        }
        const rel = relative(specsRoot, path);
        violations.push({
            path: rel,
            line: 1,
            fix: `create \`specs/${facet}/${facet}.specification.ts\` calling \`specification.${facet}()\`, or rename the folder`,
            found: `\`specs/${facet}/\`, a facet folder with no specification constructing \`specification.${facet}()\``,
            rule: 'facet-folder-has-specification',
        });
    }
    return violations;
}
