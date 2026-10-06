import {
    GROUND_FOLDERS,
    moveKeepingHistory,
    SHARED_FOLDER,
    treeEntries,
} from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { repointFiles, repointModuleTests } from '../../kit/checker/repoint.js';
import { collectFixtureReferences } from '../../kit/project/named-paths.js';
import {
    DISK_CALL,
    findSpecsRoots,
    isDir,
    isWithin,
    listReaders,
    removeIfEmpty,
} from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

function poolsOf(specsRoot: string): string[] {
    return GROUND_FOLDERS.map((ground) => join(specsRoot, SHARED_FOLDER, ground));
}

/** `map/pois/` holds the ground `map/pois/detail/` shares with it. */
function inEnclosingGround(specsRoot: string, leaf: string, target: string): boolean {
    for (let folder = dirname(leaf); isWithin(specsRoot, folder); folder = dirname(folder)) {
        if (GROUND_FOLDERS.some((role) => isWithin(join(folder, role), target))) {
            return true;
        }
    }
    return false;
}

function rootGroundOf(specsRoot: string): string[] {
    return GROUND_FOLDERS.map((role) => join(specsRoot, role)).filter((folder) => isDir(folder));
}

export function checkNoReachIntoSiblingGround(rootDir: string): Spotted[] {
    const violations: Spotted[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        const pools = poolsOf(specsRoot);
        for (const folder of rootGroundOf(specsRoot)) {
            const role = basename(folder);
            violations.push({
                path: relative(rootDir, folder),
                line: 1,
                fix: `move it to ${relative(rootDir, join(specsRoot, SHARED_FOLDER, role))}/ — \`typescript fix\` moves it and rewrites every whole relative path that names it`,
                found: `${role}/ at the specs root, shared ground outside ${relative(rootDir, join(specsRoot, SHARED_FOLDER))}/`,
                rule: 'no-reach-into-sibling-ground',
            });
        }
        for (const file of listReaders(specsRoot)) {
            const leaf = dirname(file);
            for (const { column, line, path } of collectFixtureReferences(file, DISK_CALL)) {
                const target = resolve(leaf, path);
                if (
                    isWithin(leaf, target) ||
                    pools.some((pool) => isWithin(pool, target)) ||
                    inEnclosingGround(specsRoot, leaf, target)
                ) {
                    continue;
                }
                const rel = relative(rootDir, file);
                violations.push({
                    column,
                    path: rel,
                    line,
                    fix: `move what it names beside ${relative(rootDir, leaf)}, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: ${relative(rootDir, join(specsRoot, SHARED_FOLDER))}/<role>/ when they span specifications`,
                    found: `"${path}" leaves ${relative(rootDir, leaf)}`,
                    rule: 'no-reach-into-sibling-ground',
                });
            }
        }
    }
    return violations;
}

/** An entry the shared folder already holds by that name stays, for the author. */
export function fixNoReachIntoSiblingGround(rootDir: string): string[] {
    const moved: string[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        for (const folder of rootGroundOf(specsRoot)) {
            const shared = join(specsRoot, SHARED_FOLDER, basename(folder));
            const moves = treeEntries(folder)
                .map((entry) => ({
                    copy: join(folder, entry.name),
                    target: join(shared, entry.name),
                }))
                .filter(({ target }) => !existsSync(target));
            if (moves.length === 0) {
                continue;
            }
            repointFiles(listReaders(specsRoot), moves);
            repointModuleTests(specsRoot, moves);
            mkdirSync(shared, { recursive: true });
            for (const { copy, target } of moves) {
                moveKeepingHistory(copy, target);
            }
            removeIfEmpty(folder);
            moved.push(`${relative(rootDir, folder)}/ → ${relative(rootDir, shared)}/`);
        }
    }
    return moved;
}
