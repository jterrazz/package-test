import { basename, dirname, join } from 'node:path';

import { importSourceVisitor, isNode } from './ast.js';
import { treeEntries } from './git-tree.js';
import {
    isGroundName,
    isReservedName,
    SETUP_FOLDER,
    SHARED_GROUND,
    UNMARKED_RESERVED,
} from './ground.js';
import { parseProgram } from './module-parser.js';
import { visitProgram } from './path-references.js';
import { resolveSpecifier } from './production.js';
import { isWithin, readText } from './tree.js';

const PRUNED = new Set(['.git', 'dist', 'node_modules']);

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
                if (!PRUNED.has(entry.name) && !isGroundName(entry.name)) {
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
    return owner === join(specsRoot, SHARED_GROUND) ? specsRoot : owner;
}

export function importedModulesOf(file: string): string[] {
    const program = parseProgram(file, readText(file));
    if (!isNode(program)) {
        return [];
    }
    const targets: string[] = [];
    visitProgram(
        program,
        importSourceVisitor(({ source }) => {
            targets.push(...resolveSpecifier(file, source));
        }),
    );
    return targets;
}

export function declaresTests(name: string): boolean {
    return /\.(?:test\.tsx?|spec\.tsx?|spec\.yaml)$/u.test(name);
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
              !isReservedName(entry.name) &&
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
        (name.startsWith('_') && !isReservedName(name)) ||
        (name === SHARED_GROUND && dirname(folder) !== specsRoot) ||
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
