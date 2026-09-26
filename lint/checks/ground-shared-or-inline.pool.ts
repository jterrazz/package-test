import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { moveKeepingHistory, treeKind } from '../../src/kernel/files/git-tree.js';
import { moduleTestsOf } from '../reading/module-tests.js';
import type { TokenViolation } from './checker.js';
import { relativeLiterals } from './repoint.js';
import {
    anchoredPaths,
    collectFixtureReferences,
    DISK_CALL,
    findPools,
    isDir,
    isLeaf,
    isWithin,
    listReferrers,
    readText,
    removeIfEmpty,
    specsRootOfPool,
} from './tree.js';

function poolEntryOf(file: string, path: string, pool: string): string | undefined {
    const inPool = relative(pool, resolve(dirname(file), path));
    if (inPool === '' || inPool.startsWith('..') || isAbsolute(inPool)) {
        return undefined;
    }
    const entry = inPool.split(sep)[0] ?? '';
    return entry.length > 0 ? entry : undefined;
}

function poolUsage(specsRoot: string, pool: string): Map<string, Map<string, string[]>> {
    const usage = new Map<string, Map<string, string[]>>();
    for (const file of listReferrers(specsRoot, pool)) {
        for (const { path } of collectFixtureReferences(file, DISK_CALL, true)) {
            const entry = poolEntryOf(file, path, pool);
            if (entry === undefined) {
                continue;
            }
            const leaves = usage.get(entry) ?? new Map<string, string[]>();
            const referrers = leaves.get(dirname(file)) ?? [];
            if (!referrers.includes(file)) {
                referrers.push(file);
            }
            leaves.set(dirname(file), referrers);
            usage.set(entry, leaves);
        }
    }
    return usage;
}

/** `undefined` when the leaves only meet above any leaf, where the pool is their common level. */
function commonLeaf(leaves: readonly string[]): string | undefined {
    const [first, ...others] = leaves;
    if (first === undefined) {
        return undefined;
    }
    let common = first;
    while (!others.every((leaf) => leaf === common || isWithin(common, leaf))) {
        const parent = dirname(common);
        if (parent === common) {
            return undefined;
        }
        common = parent;
    }
    return leaves.includes(common) || (others.length > 0 && isLeaf(common)) ? common : undefined;
}

type MisplacedPoolFixture = {
    entry: string;
    leaf: string;
    pool: string;
    referrers: string[];
};

/** A module test reads its ground from outside every leaf, so what it names is shared, whatever the specs say. */
export function pathsModuleTestsName(member: string): string[] {
    const named: string[] = [];
    for (const file of moduleTestsOf(member)) {
        for (const { value } of relativeLiterals(readText(file))) {
            named.push(resolve(dirname(file), value));
        }
        for (const { target } of anchoredPaths(file)) {
            named.push(target);
        }
    }
    return named;
}

/** Two documents of one leaf count once: the unit is the folder. An entry nothing names is `no-unused-ground`'s case, not this one. */
function misplacedPoolFixtures(rootDir: string): MisplacedPoolFixture[] {
    const misplaced: MisplacedPoolFixture[] = [];
    const named = new Map<string, string[]>();
    for (const pool of findPools(rootDir)) {
        const specsRoot = specsRootOfPool(pool);
        const member = dirname(specsRoot);
        const paths = named.get(member) ?? pathsModuleTestsName(member);
        named.set(member, paths);
        const readOutside = new Set(
            paths.flatMap((path) => poolEntryOf(dirname(path), path, pool) ?? []),
        );
        for (const [entry, leaves] of poolUsage(specsRoot, pool)) {
            const leaf = commonLeaf([...leaves.keys()]);
            if (
                leaf === undefined ||
                readOutside.has(entry) ||
                treeKind(join(pool, entry)) === undefined
            ) {
                continue;
            }
            misplaced.push({ entry, leaf, pool, referrers: [...leaves.values()].flat() });
        }
    }
    return misplaced;
}

export function checkPoolFixtureSharing(rootDir: string): TokenViolation[] {
    return misplacedPoolFixtures(rootDir).map(({ entry, leaf, pool, referrers }) => {
        const relEntry = relative(rootDir, join(pool, entry));
        const relLeaf = relative(rootDir, leaf);
        const role = basename(pool);
        const named = isDir(join(pool, entry))
            ? `directory('./${role}/${entry}/')`
            : `file('./${role}/${entry}')`;
        const nested = referrers.some((file) => dirname(file) !== leaf);
        return {
            file: relEntry,
            line: 1,
            fix: nested
                ? `move it to ${relLeaf}/${role}/${entry}, the route's own ground, and name it from each leaf — ${named} there, the path that climbs to it from the leaves inside — \`make fix\` does both`
                : `move it to ${relLeaf}/${role}/${entry} and name it ${named} — \`make fix\` does both`,
            found: nested
                ? `a pool entry only ${relLeaf} and the leaves inside it reach for`
                : `a pool entry only ${relLeaf} reaches for`,
            rule: 'ground-shared-or-inline',
            severity: 'error',
        };
    });
}

/** A pool the move empties goes with it, and the shared folder when it was the last. */
export function fixPoolFixtures(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { entry, leaf, pool, referrers } of misplacedPoolFixtures(rootDir)) {
        const role = basename(pool);
        const destination = join(leaf, role, entry);
        if (existsSync(destination)) {
            continue;
        }
        mkdirSync(dirname(destination), { recursive: true });
        moveKeepingHistory(join(pool, entry), destination);
        for (const file of referrers) {
            const text = readText(file);
            const climb = relative(dirname(file), pool).split(sep).join('/');
            const down = relative(dirname(file), join(leaf, role)).split(sep).join('/');
            const next = text.replaceAll(
                `${climb}/${entry}`,
                `${down.startsWith('.') ? down : `./${down}`}/${entry}`,
            );
            if (next !== text) {
                writeFileSync(file, next);
            }
        }
        removeIfEmpty(pool);
        removeIfEmpty(dirname(pool));
        moved.push(`${relative(rootDir, join(pool, entry))} → ${relative(rootDir, destination)}`);
    }
    return moved;
}
