import {
    forgetTree,
    GROUND_FOLDERS,
    moveKeepingHistory,
    treeEntries,
    treeKind,
} from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { repointFiles, repointModuleTests } from '../../kit/checker/repoint.js';
import { documentReferences, RELATIVE_LITERAL } from '../../kit/project/ground-readers.js';
import { isTestFileName } from '../../kit/project/role.js';
import { shown } from '../../kit/project/spec-subjects.js';
import { listFiles, lowestCommonFolder, reservedFolderOf } from '../../kit/project/tree.js';

// invariant: a document reads its ground by its `fixture:` lines as a spec does by its literals: both follow a lifted entry.
function diskReferences(specsRoot: string): { file: string; target: string }[] {
    return [...sourceReferences(specsRoot), ...documentReferences(specsRoot)];
}

function sourceReferences(specsRoot: string): { file: string; target: string }[] {
    // Stryker disable OptionalChaining: a match always carries its named groups
    return listFiles(specsRoot, (path) => isTestFileName(basename(path))).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(RELATIVE_LITERAL)].map((found) => ({
            file,
            target: resolve(dirname(file), found.groups?.path ?? '.'),
        })),
    );
    // Stryker restore OptionalChaining
}

function isAtOrBelow(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry}${sep}`);
}

type Ground = {
    folder: string;
    references: readonly { file: string; target: string }[];
    role: string;
};

function liftEntry(specsRoot: string, ground: Ground, path: string): string[] {
    const readers = ground.references.filter(({ target }) => isAtOrBelow(path, target));
    // invariant: an entry its leaf alone reads has its own place as destination, which exists.
    if (readers.length === 0) {
        return [];
    }
    const lowest = lowestCommonFolder(readers.map(({ file }) => dirname(file))) ?? specsRoot;
    const destination = join(reservedFolderOf(lowest, ground.role), relative(ground.folder, path));
    if (existsSync(destination)) {
        // invariant: a namesake folder at the new place is entered, each entry below going where its own readers meet; a file there holds the name, and `no-reach-into-sibling-ground` keeps reporting the reach.
        return treeKind(path) === 'directory' && treeKind(destination) === 'directory'
            ? liftEntries(specsRoot, ground, path)
            : [];
    }
    mkdirSync(dirname(destination), { recursive: true });
    moveKeepingHistory(path, destination);
    const moves = [{ copy: path, target: destination }];
    repointModuleTests(specsRoot, moves);
    repointFiles([...new Set(readers.map((reader) => reader.file))], moves);
    return [`${shown(specsRoot, path)} → ${shown(specsRoot, destination)}`];
}

function liftEntries(specsRoot: string, ground: Ground, folder: string): string[] {
    const lifted = treeEntries(folder).flatMap((entry) =>
        liftEntry(specsRoot, ground, join(folder, entry.name)),
    );
    if (readdirSync(folder).length === 0) {
        rmSync(folder, { recursive: true });
    }
    return lifted;
}

/** An entry of the leaf's ground goes to the lowest folder its readers share, once a reader has left the leaf. */
export function liftGround(specsRoot: string, leaf: string): string[] {
    const lifted: string[] = [];
    const references = diskReferences(specsRoot);
    for (const role of GROUND_FOLDERS) {
        const folder = join(leaf, role);
        if (treeKind(folder) !== 'directory') {
            continue;
        }
        for (const entry of treeEntries(folder)) {
            lifted.push(
                ...liftEntry(specsRoot, { folder, references, role }, join(folder, entry.name)),
            );
        }
        if (readdirSync(folder).length === 0) {
            rmSync(folder, { recursive: true });
        }
    }
    // Stryker disable next-line CallExpression: outside a git work tree the walk reads the disk afresh
    forgetTree();
    return lifted;
}
