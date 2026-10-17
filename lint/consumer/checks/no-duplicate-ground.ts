import {
    GROUND_FOLDERS,
    moveKeepingHistory,
    treeEntries,
    treeKind,
} from '@jterrazz/typescript/rules';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { repointFiles, repointModuleTests } from '../../kit/checker/repoint.js';
import {
    findSpecsRoots,
    isConventionalSubdir,
    isDir,
    isReferrer,
    listDirs,
    listFiles,
    lowestCommonFolder,
    reservedFolderOf,
} from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

// outside: a tree compares by the listing git keeps, so an ignored file is no difference.
function fingerprintOf(path: string): string {
    const hash = createHash('sha256');
    const visit = (current: string, below: string): void => {
        if (!isDir(current)) {
            hash.update(`${below}\0`);
            hash.update(readFileSync(current));
            // Stryker disable next-line StringLiteral,CallExpression: each file's name opens its own record, so the separator after its bytes changes no comparison
            hash.update('\0');
            return;
        }
        const children = treeEntries(current)
            .map((child) => child.name)
            .toSorted();
        for (const name of children) {
            visit(join(current, name), `${below}/${name}`);
        }
    };
    // Stryker disable next-line StringLiteral: every entry is walked from the same root name
    visit(path, '');
    // Stryker disable next-line StringLiteral: no file and tree share a digest, whatever their kinds are called
    const kind = isDir(path) ? 'tree' : 'file';
    // Stryker disable next-line StringLiteral: a digest in any encoding compares alike
    const digest = hash.digest('hex');
    return `${kind}:${digest}`;
}

type CopiedGround = {
    // invariant: sorted: the first is the one a fix moves.
    copies: string[];
    fingerprint: string;
    specsRoot: string;
    // invariant: `null` when the copies go by several names: none of them is the one to keep.
    target: null | string;
};

function leafGroundOf(
    specsRoot: string,
): Map<string, { copies: string[]; fingerprint: string; role: string }> {
    const groups = new Map<string, { copies: string[]; fingerprint: string; role: string }>();
    for (const dir of listDirs(specsRoot)) {
        if (dir === specsRoot) {
            continue;
        }
        for (const role of GROUND_FOLDERS) {
            const ground = join(dir, role);
            if (!isConventionalSubdir(ground)) {
                continue;
            }
            for (const entry of treeEntries(ground)) {
                const path = join(ground, entry.name);
                const fingerprint = fingerprintOf(path);
                const key = `${role}\0${fingerprint}`;
                const group = groups.get(key) ?? { copies: [], fingerprint, role };
                group.copies.push(path);
                groups.set(key, group);
            }
        }
    }
    return groups;
}

function copiedGround(rootDir: string): CopiedGround[] {
    const copied: CopiedGround[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        for (const { copies, fingerprint, role } of leafGroundOf(specsRoot).values()) {
            const leaves = new Set(copies.map((copy) => dirname(dirname(copy))));
            if (leaves.size < 2) {
                continue;
            }
            const names = new Set(copies.map((copy) => basename(copy)));
            const [name] = names;
            const lowest = lowestCommonFolder([...leaves]) ?? specsRoot;
            const target =
                // Stryker disable next-line ConditionalExpression: one name is a first name
                names.size === 1 && name !== undefined
                    ? join(reservedFolderOf(lowest, role), name)
                    : null;
            copied.push({
                copies: copies.filter((copy) => copy !== target).toSorted(),
                fingerprint,
                specsRoot,
                target,
            });
        }
    }
    return copied;
}

function copyAdvice(rootDir: string, { fingerprint, target }: CopiedGround): string {
    if (target === null) {
        return 'give the copies the one name the entry should keep: they go by several, so `typescript fix` moves none';
    }
    const where = relative(rootDir, target);
    if (treeKind(target) !== undefined && fingerprintOf(target) !== fingerprint) {
        return `keep one copy in ${where}, which holds another ${basename(target)}, so rename one of the two first`;
    }
    return `keep one copy in ${where}; \`typescript fix\` moves it there and rewrites every whole relative path that named a copy`;
}

/** `--fix` acts only when the copies share one name, the only name a fix could keep. */
export function checkNoDuplicateGround(rootDir: string): Spotted[] {
    return copiedGround(rootDir).flatMap((group) => {
        const advice = copyAdvice(rootDir, group);
        return group.copies.map((copy) => ({
            path: relative(rootDir, copy),
            line: 1,
            fix: advice,
            found: `the same ${isDir(copy) ? 'tree' : 'file'} as ${group.copies
                .filter((other) => other !== copy)
                .map((other) => relative(rootDir, other))
                .join(', ')}`,
            rule: 'no-duplicate-ground',
        }));
    });
}

function repointReferrers(specsRoot: string, copies: readonly string[], target: string): void {
    const moves = copies.map((copy) => ({ copy, target }));
    repointFiles(listFiles(specsRoot, isReferrer), moves);
    repointModuleTests(specsRoot, moves);
}

function keepOne(copies: readonly string[], target: string, held: boolean): void {
    const [first, ...others] = copies;
    // Stryker disable next-line ConditionalExpression,BlockStatement: a group always has a first copy
    if (first === undefined) {
        return;
    }
    if (!held) {
        mkdirSync(dirname(target), { recursive: true });
        moveKeepingHistory(first, target);
    }
    for (const copy of held ? copies : others) {
        rmSync(copy, { recursive: true });
    }
    for (const ground of new Set(copies.map((copy) => dirname(copy)))) {
        if (readdirSync(ground).length === 0) {
            rmSync(ground, { recursive: true });
        }
    }
}

/** An entry the target already holds byte for byte deletes every copy; one holding something else, or copies of several names, are the author's call and nothing moves. */
export function fixNoDuplicateGround(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { copies, fingerprint, specsRoot, target } of copiedGround(rootDir)) {
        const held = target !== null && treeKind(target) !== undefined;
        if (target !== null && !(held && fingerprintOf(target) !== fingerprint)) {
            repointReferrers(specsRoot, copies, target);
            keepOne(copies, target, held);
            moved.push(
                `${copies.map((copy) => relative(rootDir, copy)).join(', ')} → ${relative(rootDir, target)}`,
            );
        }
    }
    return moved;
}
