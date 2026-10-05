import { relative } from 'node:path';

import {
    specificationFoldersOf,
    specificationsIn,
} from '../../kit/project/specification-folders.js';
import { readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

export function checkSpecificationFolderHasItsRunner(specsRoot: string): Spotted[] {
    return specificationFoldersOf(specsRoot)
        .filter(
            ({ specification, path }) =>
                !specificationsIn(path).some((file) =>
                    readText(file).includes(`specification.${specification}(`),
                ),
        )
        .map(({ specification, path }) => ({
            path: relative(specsRoot, path),
            line: 1,
            fix: `create \`specs/${specification}/${specification}.specification.ts\` calling \`specification.${specification}()\`, or rename the folder`,
            found: `\`specs/${specification}/\`, a specification folder with no runner constructing \`specification.${specification}()\``,
            rule: 'specification-folder-has-its-runner',
        }));
}
