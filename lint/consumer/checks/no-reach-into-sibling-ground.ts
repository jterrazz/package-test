import { GROUND_FOLDERS } from '@jterrazz/typescript/rules';
import { dirname, join, relative, resolve } from 'node:path';

import { collectFixtureReferences } from '../../kit/project/named-paths.js';
import { DISK_CALL, findSpecsRoots, isWithin, listReaders } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

/** `map/pois/` holds the ground `map/pois/detail/` shares with it, and the specs root the ground its specifications share. */
function inEnclosingGround(specsRoot: string, leaf: string, target: string): boolean {
    const enclosing = [specsRoot];
    for (let folder = dirname(leaf); isWithin(specsRoot, folder); folder = dirname(folder)) {
        enclosing.push(folder);
    }
    return enclosing.some((folder) =>
        GROUND_FOLDERS.some((role) => isWithin(join(folder, role), target)),
    );
}

export function checkNoReachIntoSiblingGround(rootDir: string): Spotted[] {
    const violations: Spotted[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        for (const file of listReaders(specsRoot)) {
            const leaf = dirname(file);
            for (const { column, line, path } of collectFixtureReferences(file, DISK_CALL)) {
                const target = resolve(leaf, path);
                if (isWithin(leaf, target) || inEnclosingGround(specsRoot, leaf, target)) {
                    continue;
                }
                const rel = relative(rootDir, file);
                violations.push({
                    column,
                    path: rel,
                    line,
                    fix: `move what it names beside ${relative(rootDir, leaf)}, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: ${join(relative(rootDir, specsRoot), '<role>')}/ when they span specifications`,
                    found: `"${path}" leaves ${relative(rootDir, leaf)}`,
                    rule: 'no-reach-into-sibling-ground',
                });
            }
        }
    }
    return violations;
}
