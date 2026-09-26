import { join, relative } from 'node:path';

import { treeEntries } from '../../engine/project/git-tree.js';
import { SETUP_FOLDER, SHARED_GROUND } from '../../engine/project/ground.js';
import { declaresTests, isRunnerName } from '../../engine/project/specs-modules.js';
import { findSpecsRoots } from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

function strayAtRoot(rootDir: string, specsRoot: string): Finding[] {
    let entries;
    try {
        entries = treeEntries(specsRoot);
    } catch {
        return [];
    }
    const found: Finding[] = [];
    for (const entry of entries) {
        if (entry.name.startsWith('.') || declaresTests(entry.name) || isRunnerName(entry.name)) {
            continue;
        }
        if (entry.isDirectory() && entry.name === SETUP_FOLDER) {
            found.push({
                file: `${relative(rootDir, join(specsRoot, SETUP_FOLDER))}/`,
                line: 1,
                fix: `move it to \`specs/${join(SHARED_GROUND, SETUP_FOLDER)}/\`, and the paths that import it`,
                found: `\`${SETUP_FOLDER}/\` at the specs root, which holds its facets and \`${SHARED_GROUND}/\` alone`,
                rule: 'specs-root-holds-facets-and-shared',
                severity: 'error',
            });
        } else if (!entry.isDirectory()) {
            found.push({
                file: relative(rootDir, join(specsRoot, entry.name)),
                line: 1,
                fix: `move it where it belongs: code into \`specs/${SHARED_GROUND}/${SETUP_FOLDER}/\` — or the \`${SETUP_FOLDER}/\` of the one facet that reads it — and data into the ground folder of its role`,
                found: `\`${entry.name}\`, a file at the specs root, which holds its facets and \`${SHARED_GROUND}/\` alone`,
                rule: 'specs-root-holds-facets-and-shared',
                severity: 'error',
            });
        }
    }
    return found;
}

export function checkSpecsRootHoldsFacetsAndShared(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => strayAtRoot(rootDir, specsRoot));
}
