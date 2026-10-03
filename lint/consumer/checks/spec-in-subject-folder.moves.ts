import {
    forgetTree,
    GROUND_FOLDERS,
    moveKeepingHistory,
    treeEntries,
    treeKind,
} from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

import { repointModuleTests } from '../../kit/checker/repoint.js';
import { documentPaths, parseSpecDocument } from '../../kit/project/spec-document.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-grammar.js';
import { shown, silenced, splitPlan, subjectSpecs } from '../../kit/project/spec-subjects.js';
import type { SpecRead } from '../../kit/project/spec-subjects.js';
import { listFiles, lowestCommonFolder, reservedFolderOf } from '../../kit/project/tree.js';
import { RELATIVE_LITERAL, relativePath } from './spec-in-subject-folder.prune.js';
import { splitFiles } from './spec-in-subject-folder.split.js';
import type { Draft } from './spec-in-subject-folder.split.js';

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
    return listFiles(specsRoot, (path) => /\.(?:spec|test)\.tsx?$/u.test(path)).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(RELATIVE_LITERAL)]
            .filter(
                (found) =>
                    found.groups?.lead?.includes('from') !== true &&
                    found.groups?.lead?.includes('import') !== true,
            )
            .map((found) => ({ file, target: resolve(dirname(file), found.groups?.path ?? '.') })),
    );
}

function isAtOrBelow(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry}${sep}`);
}

function liftGround(specsRoot: string, leaf: string): string[] {
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
            if (readers.every(({ file }) => dirname(file) === leaf)) {
                continue;
            }
            const lowest =
                lowestCommonFolder(readers.map(({ file }) => dirname(file))) ?? specsRoot;
            const destination = join(reservedFolderOf(specsRoot, lowest, role), entry.name);
            // invariant: the pool holds that name: `no-reach-into-sibling-ground` keeps reporting the reach.
            if (existsSync(destination)) {
                continue;
            }
            mkdirSync(dirname(destination), { recursive: true });
            moveKeepingHistory(path, destination);
            repointModuleTests(specsRoot, [{ copy: path, target: destination }]);
            for (const file of new Set(readers.map((reader) => reader.file))) {
                const text = readFileSync(file, 'utf8');
                const next = text.replaceAll(
                    relativePath(dirname(file), path),
                    relativePath(dirname(file), destination),
                );
                if (next !== text) {
                    writeFileSync(file, next);
                }
            }
            lifted.push(`${shown(specsRoot, path)} → ${shown(specsRoot, destination)}`);
        }
        if (readdirSync(folder).length === 0) {
            rmSync(folder, { recursive: true });
        }
    }
    forgetTree();
    return lifted;
}

function writeSplit(
    specsRoot: string,
    spec: SpecRead,
    keepsFile: boolean,
    written: readonly Draft[],
): string[] {
    const [opening] = written;
    if (opening !== undefined && !keepsFile && opening.target !== spec.file) {
        mkdirSync(dirname(opening.target), { recursive: true });
        moveKeepingHistory(spec.file, opening.target);
    }
    for (const { target, text } of written) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text);
    }
    return written
        .filter(({ target }) => target !== spec.file)
        .map(({ target }) => `${shown(specsRoot, spec.file)} → ${shown(specsRoot, target)}`);
}

/** A test reaching two subjects goes with the one its chain opens on; a file whose target is taken is left for its author. */
export function fixSpecInSubjectFolder(specsRoot: string): string[] {
    const done: string[] = [];
    for (const spec of subjectSpecs(specsRoot)) {
        const rule = spec.subjects.size > 1 ? 'one-subject-per-spec' : 'spec-in-subject-folder';
        if (spec.subjects.size === 0 || silenced(spec, rule)) {
            continue;
        }
        const plan = splitPlan(specsRoot, spec);
        const targets = [...plan.values()];
        if (targets.every((target) => target === spec.file)) {
            continue;
        }
        if (targets.some((target) => target !== spec.file && existsSync(target))) {
            continue;
        }
        done.push(
            ...writeSplit(
                specsRoot,
                spec,
                targets.includes(spec.file),
                splitFiles(specsRoot, spec, plan),
            ),
        );
        forgetTree();
        done.push(...liftGround(specsRoot, dirname(spec.file)));
        removeEmptied(specsRoot, dirname(spec.file));
    }
    return done;
}

function removeEmptied(specsRoot: string, folder: string): void {
    let current = folder;
    while (current !== specsRoot && current.startsWith(specsRoot) && existsSync(current)) {
        if (readdirSync(current).length > 0) {
            break;
        }
        rmSync(current, { recursive: true });
        current = dirname(current);
    }
    forgetTree();
}
