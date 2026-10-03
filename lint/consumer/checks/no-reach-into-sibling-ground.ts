import {
    GROUND_FOLDERS,
    moveKeepingHistory,
    SHARED_FOLDER,
    treeEntries,
} from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import {
    repointDocument,
    repointed,
    repointModuleTests,
    repointSource,
} from '../../kit/checker/repoint.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-document.js';
import {
    collectFixtureReferences,
    DISK_CALL,
    findSpecsRoots,
    isDir,
    isWithin,
    listReaders,
    listReferrers,
    readText,
    removeIfEmpty,
} from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

export function poolsOf(specsRoot: string): string[] {
    return GROUND_FOLDERS.map((ground) => join(specsRoot, SHARED_FOLDER, ground));
}

/** `map/pois/` holds the ground `map/pois/detail/` shares with it. */
function enclosingGround(specsRoot: string, leaf: string): string[] {
    const ground: string[] = [];
    for (let folder = dirname(leaf); isWithin(specsRoot, folder) && folder !== specsRoot;) {
        ground.push(...GROUND_FOLDERS.map((role) => join(folder, role)));
        const parent = dirname(folder);
        if (parent === folder) {
            break;
        }
        folder = parent;
    }
    return ground;
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
                    enclosingGround(specsRoot, leaf).some((ground) => isWithin(ground, target))
                ) {
                    continue;
                }
                const rel = relative(rootDir, file);
                violations.push({
                    column,
                    path: rel,
                    line,
                    fix: `move what it names beside ${relative(rootDir, leaf)}, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: ${relative(rootDir, join(specsRoot, SHARED_FOLDER))}/<role>/ when they span facets`,
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
            for (const file of listReferrers(specsRoot, folder)) {
                const from = dirname(file);
                const move = (path: string): string | undefined =>
                    moves
                        .map((each) => repointed(from, path, each))
                        .find((next) => next !== undefined);
                const text = readText(file);
                const next = file.endsWith(SPEC_EXTENSION)
                    ? repointDocument(file, move)
                    : repointSource(file, move);
                if (next !== text) {
                    writeFileSync(file, next);
                }
            }
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
