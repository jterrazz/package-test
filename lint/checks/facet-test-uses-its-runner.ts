import { relative } from 'node:path';

import { isGroundName } from '../../src/kernel/files/ground.js';
import { reachesRunner } from '../reading/facets.js';
import { isTestFileName } from '../reading/role.js';
import type { TokenViolation } from './checker.js';
import { facetFoldersOf, specificationsIn, textOf, walkFiles } from './facet-folders.js';

function isUnderGround(relativePath: string): boolean {
    return relativePath.split(/[/\\]/u).some((segment) => isGroundName(segment));
}

export function checkModuleTestUnderFacet(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const { facet, path } of facetFoldersOf(specsRoot)) {
        if (specificationsIn(path).length === 0) {
            // `facet-folder-has-specification` owns the folder with no runner at all.
            continue;
        }
        for (const file of walkFiles(path)) {
            const name = file.slice(file.lastIndexOf('/') + 1);
            if (!isTestFileName(name)) {
                continue;
            }
            // A test file under ground is a golden or its input, never a spec.
            if (isUnderGround(relative(path, file))) {
                continue;
            }
            if (reachesRunner(textOf(file) ?? '')) {
                continue;
            }
            const rel = relative(specsRoot, file);
            violations.push({
                file: rel,
                line: 1,
                fix: `import \`{ ${facet} }\` from \`${facet}.specification.js\` and drive the product through it, or move the module test beside its module`,
                found: `a test under the \`${facet}\` facet that reaches no runner`,
                rule: 'facet-test-uses-its-runner',
                severity: 'error',
            });
        }
    }
    return violations;
}
