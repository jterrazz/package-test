import { relative } from 'node:path';

import { facetFoldersOf, specificationsIn } from '../../kit/project/facet-folders.js';
import { readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

export function checkFacetFolderHasSpecification(specsRoot: string): Spotted[] {
    return facetFoldersOf(specsRoot)
        .filter(
            ({ facet, path }) =>
                !specificationsIn(path).some((file) =>
                    readText(file).includes(`specification.${facet}(`),
                ),
        )
        .map(({ facet, path }) => ({
            path: relative(specsRoot, path),
            line: 1,
            fix: `create \`specs/${facet}/${facet}.specification.ts\` calling \`specification.${facet}()\`, or rename the folder`,
            found: `\`specs/${facet}/\`, a facet folder with no specification constructing \`specification.${facet}()\``,
            rule: 'facet-folder-has-specification',
        }));
}
