import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import {
    repointDocument,
    repointed,
    repointModuleTests,
    repointSource,
} from '../../engine/checker/repoint.js';
import { moveKeepingHistory, treeEntries, treeKind } from '../../engine/project/git-tree.js';
import { GROUND_DIRS } from '../../engine/project/ground.js';
import { SPEC_EXTENSION } from '../../engine/project/spec-document.js';
import {
    findSpecsRoots,
    isConventionalSubdir,
    isDir,
    isReferrer,
    isSharedFolder,
    listDirs,
    listFiles,
    lowestCommonFolder,
    readText,
    reservedFolderOf,
} from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

/** A tree compares by the listing git keeps, so an ignored file is no difference. */
function fingerprintOf(path: string): string {
    const hash = createHash('sha256');
    const visit = (current: string, below: string): void => {
        if (!isDir(current)) {
            hash.update(`${below}\0`);
            hash.update(readFileSync(current));
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
    visit(path, '');
    return `${isDir(path) ? 'tree' : 'file'}:${hash.digest('hex')}`;
}

type CopiedGround = {
    /** Sorted: the first is the one a fix moves. */
    copies: string[];
    fingerprint: string;
    specsRoot: string;
    /** `null` when the copies go by several names: none of them is the one to keep. */
    target: null | string;
};

function leafGroundOf(
    specsRoot: string,
): Map<string, { copies: string[]; fingerprint: string; role: string }> {
    const groups = new Map<string, { copies: string[]; fingerprint: string; role: string }>();
    for (const dir of listDirs(specsRoot)) {
        if (dir === specsRoot || isSharedFolder(dir)) {
            continue;
        }
        for (const role of GROUND_DIRS) {
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
                names.size === 1 && name !== undefined
                    ? join(reservedFolderOf(specsRoot, lowest, role), name)
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
        return 'give the copies the one name the entry should keep — they go by several, so `make fix` moves none';
    }
    const where = relative(rootDir, target);
    if (treeKind(target) !== undefined && fingerprintOf(target) !== fingerprint) {
        return `keep one copy in ${where} — it holds another ${basename(target)}, so rename one of the two first`;
    }
    return `keep one copy in ${where} — \`make fix\` moves it there and rewrites every path that named a copy`;
}

/** `--fix` acts only when the copies share one name, the only name a fix could keep. */
export function checkNoDuplicateGround(rootDir: string): Finding[] {
    return copiedGround(rootDir).flatMap((group) => {
        const advice = copyAdvice(rootDir, group);
        return group.copies.map((copy) => ({
            file: relative(rootDir, copy),
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

/** An entry the target already holds byte for byte deletes every copy; one holding something else, or copies of several names, are the author's call and nothing moves. */
export function fixNoDuplicateGround(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { copies, fingerprint, specsRoot, target } of copiedGround(rootDir)) {
        if (target === null) {
            continue;
        }
        const held = treeKind(target) !== undefined;
        if (held && fingerprintOf(target) !== fingerprint) {
            continue;
        }
        for (const file of listFiles(specsRoot, isReferrer)) {
            const from = dirname(file);
            const move = (path: string): string | undefined =>
                copies
                    .map((copy) => repointed(from, path, { copy, target }))
                    .find((next) => next !== undefined);
            const text = readText(file);
            const next = file.endsWith(SPEC_EXTENSION)
                ? repointDocument(file, move)
                : repointSource(file, move);
            if (next !== text) {
                writeFileSync(file, next);
            }
        }
        repointModuleTests(
            specsRoot,
            copies.map((copy) => ({ copy, target })),
        );
        const [first, ...others] = copies;
        if (first !== undefined && !held) {
            mkdirSync(dirname(target), { recursive: true });
            moveKeepingHistory(first, target);
        }
        for (const copy of held ? copies : others) {
            rmSync(copy, { force: true, recursive: true });
        }
        for (const ground of new Set(copies.map((copy) => dirname(copy)))) {
            if (existsSync(ground) && readdirSync(ground).length === 0) {
                rmSync(ground, { recursive: true });
            }
        }
        moved.push(
            `${copies.map((copy) => relative(rootDir, copy)).join(', ')} → ${relative(rootDir, target)}`,
        );
    }
    return moved;
}
