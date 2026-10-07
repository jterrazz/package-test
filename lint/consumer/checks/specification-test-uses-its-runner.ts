import { isGroundFolder } from '@jterrazz/typescript/rules';
import { basename, relative } from 'node:path';

import { isTestFileName } from '../../kit/project/role.js';
import {
    specificationFoldersOf,
    specificationsIn,
    walkFiles,
} from '../../kit/project/specification-folders.js';
import { reachesRunner } from '../../kit/project/specifications.js';
import { readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

function isUnderGround(relativePath: string): boolean {
    return relativePath.split(/[/\\]/u).some((segment) => isGroundFolder(segment));
}

export function checkSpecificationTestUsesItsRunner(specsRoot: string): Spotted[] {
    const violations: Spotted[] = [];
    for (const { specification, path } of specificationFoldersOf(specsRoot)) {
        if (specificationsIn(path).length === 0) {
            // invariant: `specification-folder-has-its-runner` owns the folder with no runner at all.
            continue;
        }
        for (const file of walkFiles(path)) {
            if (!isTestFileName(basename(file))) {
                continue;
            }
            // invariant: a test file under ground is a golden or its input, never a spec.
            if (isUnderGround(relative(path, file))) {
                continue;
            }
            // Stryker disable next-line StringLiteral: a file the walk listed reads, and no stand-in for none reaches a runner
            if (reachesRunner(readText(file))) {
                continue;
            }
            const rel = relative(specsRoot, file);
            violations.push({
                path: rel,
                line: 1,
                fix: `import \`{ ${specification} }\` from \`${specification}.specification.js\` and drive the product through it, or move the module test into the \`__tests__/\` of its module’s folder`,
                found: `a test under the \`${specification}\` specification that reaches no runner`,
                rule: 'specification-test-uses-its-runner',
            });
        }
    }
    return violations;
}
