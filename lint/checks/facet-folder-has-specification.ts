import { relative } from 'node:path';

import type { TokenViolation } from './checker.js';
import { facetFoldersOf, specificationsIn, textOf } from './facet-folders.js';

export function checkFacetFolder(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const { facet, path } of facetFoldersOf(specsRoot)) {
        const constructs = specificationsIn(path).some((file) =>
            (textOf(file) ?? '').includes(`specification.${facet}(`),
        );
        if (constructs) {
            continue;
        }
        const rel = relative(specsRoot, path);
        violations.push({
            file: rel,
            line: 1,
            fix: `create \`specs/${facet}/${facet}.specification.ts\` calling \`specification.${facet}()\`, or rename the folder`,
            found: `\`specs/${facet}/\`, a facet folder with no specification constructing \`specification.${facet}()\``,
            rule: 'facet-folder-has-specification',
            severity: 'error',
        });
    }
    return violations;
}
