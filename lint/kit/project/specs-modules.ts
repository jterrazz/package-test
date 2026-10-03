import {
    isGroundFolder,
    isReservedFolder,
    PRUNED,
    SETUP_FOLDER,
    SHARED_FOLDER,
    treeEntries,
    UNMARKED_RESERVED,
} from '@jterrazz/typescript/rules';
import { basename, dirname, join } from 'node:path';

import { isNode } from './ast.js';
import { importSourceVisitor } from './import-sources.js';
import { parseProgram } from './module-parser.js';
import { visitProgram } from './path-references.js';
import { isRelativePath } from './relative-path.js';
import { SPEC_EXTENSION } from './spec-grammar.js';
import { resolveSpecifier } from './specifiers.js';
import { isWithin, lowestCommonFolder, readText } from './tree.js';

export const COMPONENT_TREE = 'component';

export const MAX_SPEC_LINES = 400;

const MODULE = /\.(?:[cm]?[jt]sx?)$/u;

const TEST_OR_SPEC = /\.(?:test|test-d|spec)\.[cm]?[jt]sx?$/u;

const RUNNER = /\.specification\.[cm]?[jt]sx?$/u;

export function isModuleName(name: string): boolean {
    return MODULE.test(name) && !name.endsWith('.d.ts');
}

export function isTestOrSpecName(name: string): boolean {
    return TEST_OR_SPEC.test(name);
}

export function isRunnerName(name: string): boolean {
    return RUNNER.test(name);
}

export function modulesUnder(specsRoot: string): string[] {
    const found: string[] = [];
    const visit = (dir: string): void => {
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!PRUNED.has(entry.name) && !isGroundFolder(entry.name)) {
                    visit(path);
                }
            } else if (isModuleName(entry.name)) {
                found.push(path);
            }
        }
    };
    visit(specsRoot);
    return found;
}

export function setupFolderOf(specsRoot: string, file: string): string | undefined {
    for (let folder = dirname(file); isWithin(specsRoot, folder); folder = dirname(folder)) {
        if (basename(folder) === SETUP_FOLDER) {
            return folder;
        }
    }
    return undefined;
}

export function ownerOfSetup(specsRoot: string, setup: string): string {
    const owner = dirname(setup);
    return owner === join(specsRoot, SHARED_FOLDER) ? specsRoot : owner;
}

export function placeOf(specsRoot: string, reader: string): string {
    const setup = setupFolderOf(specsRoot, reader);
    return setup === undefined ? dirname(reader) : ownerOfSetup(specsRoot, setup);
}

type Imported = { relative: boolean; targets: string[] };

function importsOf(file: string): Imported[] {
    const program = parseProgram(file, readText(file));
    if (!isNode(program)) {
        return [];
    }
    const imported: Imported[] = [];
    visitProgram(
        program,
        importSourceVisitor(({ source }) => {
            imported.push({
                relative: isRelativePath(source),
                targets: resolveSpecifier(file, source),
            });
        }),
    );
    return imported;
}

export function importedModulesOf(file: string): string[] {
    return importsOf(file).flatMap(({ targets }) => targets);
}

export function importsThroughAlias(file: string, module: string): boolean {
    return importsOf(file).some(({ relative, targets }) => !relative && targets.includes(module));
}

export function readersOf(modules: readonly string[]): Map<string, string[]> {
    const known = new Set(modules);
    const readers = new Map<string, string[]>();
    for (const file of modules) {
        for (const target of new Set(importedModulesOf(file))) {
            if (target !== file && known.has(target)) {
                readers.set(target, [...(readers.get(target) ?? []), file]);
            }
        }
    }
    return readers;
}

export function lowestPlaceOf(specsRoot: string, readers: readonly string[]): string | undefined {
    return lowestCommonFolder(readers.map((reader) => placeOf(specsRoot, reader)));
}

export function declaresTests(name: string): boolean {
    return isTestOrSpecName(name) || name.endsWith(SPEC_EXTENSION);
}

export function holdsASpec(folder: string): boolean {
    let entries;
    try {
        entries = treeEntries(folder);
    } catch {
        return false;
    }
    return entries.some((entry) =>
        entry.isDirectory()
            ? !PRUNED.has(entry.name) &&
              !isReservedFolder(entry.name) &&
              holdsASpec(join(folder, entry.name))
            : declaresTests(entry.name),
    );
}

export function isUnmarkedReserved(specsRoot: string, folder: string): boolean {
    return (
        UNMARKED_RESERVED[basename(folder)] !== undefined &&
        (dirname(folder) === specsRoot || !holdsASpec(folder))
    );
}

function isRefusedReserved(specsRoot: string, folder: string): boolean {
    const name = basename(folder);
    return (
        (name.startsWith('_') && !isReservedFolder(name)) ||
        (name === SHARED_FOLDER && dirname(folder) !== specsRoot) ||
        isUnmarkedReserved(specsRoot, folder)
    );
}

export function refusedReservedAbove(specsRoot: string, file: string): string | undefined {
    for (let folder = dirname(file); isWithin(specsRoot, folder); folder = dirname(folder)) {
        if (isRefusedReserved(specsRoot, folder)) {
            return folder;
        }
    }
    return undefined;
}
