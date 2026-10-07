import {
    forgetTree,
    GROUND_FOLDERS,
    moveKeepingHistory,
    treeEntries,
    treeKind,
} from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

import { pathFrom, repointModuleTests } from '../../kit/checker/repoint.js';
import { isTestFileName } from '../../kit/project/role.js';
import { documentPaths, parseSpecDocument } from '../../kit/project/spec-document.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-grammar.js';
import { shown } from '../../kit/project/spec-subjects.js';
import { listFiles, lowestCommonFolder, reservedFolderOf } from '../../kit/project/tree.js';
import { RELATIVE_LITERAL } from './spec-in-subject-folder.prune.js';

function documentReferences(specsRoot: string): { file: string; target: string }[] {
    return listFiles(specsRoot, (path) => path.endsWith(SPEC_EXTENSION)).flatMap((file) => {
        try {
            return documentPaths(parseSpecDocument(readFileSync(file, 'utf8'), file)).map(
                ({ path }) => ({ file, target: resolve(dirname(file), path) }),
            );
        } catch {
            return [];
        }
    });
}

/** A document reads its ground by its `fixture:` lines as a spec does by its literals: both follow a lifted entry. */
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
            const path = join(folder, entry.name);
            const readers = references.filter(({ target }) => isAtOrBelow(path, target));
            // invariant: an entry its leaf alone reads has its own place as destination, which exists.
            if (readers.length === 0) {
                continue;
            }
            const lowest =
                lowestCommonFolder(readers.map(({ file }) => dirname(file))) ?? specsRoot;
            const destination = join(reservedFolderOf(lowest, role), entry.name);
            // invariant: the pool holds that name: `no-reach-into-sibling-ground` keeps reporting the reach.
            if (existsSync(destination)) {
                continue;
            }
            mkdirSync(dirname(destination), { recursive: true });
            moveKeepingHistory(path, destination);
            repointModuleTests(specsRoot, [{ copy: path, target: destination }]);
            for (const file of new Set(readers.map((reader) => reader.file))) {
                const from = dirname(file);
                const text = readFileSync(file, 'utf8');
                writeFileSync(
                    file,
                    text.replaceAll(pathFrom(from, path), pathFrom(from, destination)),
                );
            }
            lifted.push(`${shown(specsRoot, path)} → ${shown(specsRoot, destination)}`);
        }
        if (readdirSync(folder).length === 0) {
            rmSync(folder, { recursive: true });
        }
    }
    // Stryker disable next-line CallExpression: outside a git work tree the walk reads the disk afresh
    forgetTree();
    return lifted;
}
