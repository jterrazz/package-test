import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { repointSource } from '../../engine/checker/repoint.js';
import { moveKeepingHistory } from '../../engine/project/git-tree.js';
import { SETUP_FOLDER } from '../../engine/project/ground.js';
import {
    importedModulesOf,
    isTestOrSpecName,
    MAX_SPEC_LINES,
    modulesUnder,
    ownerOfSetup,
    setupFolderOf,
} from '../../engine/project/specs-modules.js';
import {
    findSpecsRoots,
    lowestCommonFolder,
    readText,
    removeIfEmpty,
    reservedFolderOf,
} from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

const STUBS_FOLDER = 'stubs';

const MODULE_EXTENSION = /\.[cm]?[jt]sx?$/u;

type Misplaced =
    | {
          module: string;
          kind: 'move';
          lowest: string;
          readers: string[];
          setup: string;
          specsRoot: string;
          target: string;
      }
    | { module: string; only: string; specsRoot: string; kind: 'inline' };

function readersOf(modules: readonly string[]): Map<string, string[]> {
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

function placeOf(specsRoot: string, reader: string): string {
    const setup = setupFolderOf(specsRoot, reader);
    return setup === undefined ? dirname(reader) : ownerOfSetup(specsRoot, setup);
}

function shown(specsRoot: string, folder: string): string {
    return folder === specsRoot ? `specs/` : `specs/${relative(specsRoot, folder)}/`;
}

function linesOf(file: string): number {
    return readText(file).split('\n').length;
}

function isStubs(setup: string, module: string): boolean {
    return relative(setup, module).split(sep).includes(STUBS_FOLDER);
}

function belongsInItsReader(setup: string, module: string, read: readonly string[]): boolean {
    const [only] = read;
    return (
        read.length === 1 &&
        only !== undefined &&
        isTestOrSpecName(basename(only)) &&
        !isStubs(setup, module) &&
        linesOf(only) + linesOf(module) <= MAX_SPEC_LINES
    );
}

function misplacedUnder(specsRoot: string): Misplaced[] {
    const modules = modulesUnder(specsRoot);
    const readers = readersOf(modules);
    const found: Misplaced[] = [];
    for (const module of modules) {
        const setup = setupFolderOf(specsRoot, module);
        const read = readers.get(module) ?? [];
        if (setup === undefined || read.length === 0) {
            continue;
        }
        const [only] = read;
        if (only !== undefined && belongsInItsReader(setup, module, read)) {
            found.push({ kind: 'inline', module, only, specsRoot });
            continue;
        }
        const lowest = lowestCommonFolder(read.map((reader) => placeOf(specsRoot, reader)));
        if (lowest === undefined) {
            continue;
        }
        const home = reservedFolderOf(specsRoot, lowest, SETUP_FOLDER);
        if (home !== setup) {
            const target = join(home, relative(setup, module));
            found.push({ kind: 'move', lowest, module, readers: read, setup, specsRoot, target });
        }
    }
    return found;
}

function findingOf(rootDir: string, misplaced: Misplaced): Finding {
    const { module, specsRoot } = misplaced;
    const rel = relative(specsRoot, module);
    if (misplaced.kind === 'inline') {
        return {
            file: relative(rootDir, module),
            line: 1,
            fix: `write what it holds in \`specs/${relative(specsRoot, misplaced.only)}\`, and delete the module — a \`${SETUP_FOLDER}/\` module exists only while several read it`,
            found: `\`specs/${rel}\`, read by \`${basename(misplaced.only)}\` alone`,
            rule: 'setup-module-at-lowest-common-folder',
            severity: 'error',
        };
    }
    return {
        file: relative(rootDir, module),
        line: 1,
        fix: `move it to \`specs/${relative(specsRoot, misplaced.target)}\` — the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — and the paths that import it; \`make fix\` does both`,
        found: `\`specs/${rel}\`, whose readers share \`${shown(specsRoot, misplaced.lowest)}\`, not \`${shown(specsRoot, ownerOfSetup(specsRoot, misplaced.setup))}\``,
        rule: 'setup-module-at-lowest-common-folder',
        severity: 'error',
    };
}

export function checkSetupModuleAtLowestCommonFolder(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) =>
        misplacedUnder(specsRoot).map((misplaced) => findingOf(rootDir, misplaced)),
    );
}

function pathFrom(from: string, to: string): string {
    const rest = relative(from, to).split(sep).join('/');
    return rest.startsWith('.') ? rest : `./${rest}`;
}

function withoutExtension(path: string): string {
    return path.replace(MODULE_EXTENSION, '');
}

function extensionOf(path: string): string {
    return MODULE_EXTENSION.exec(path)?.[0] ?? '';
}

function rewriteOwnImports(module: string, target: string): void {
    const next = repointSource(module, (path) => {
        const reached = resolve(dirname(module), path);
        return pathFrom(dirname(target), reached);
    });
    writeFileSync(module, next);
}

function repointImporter(file: string, module: string, target: string): void {
    const text = readText(file);
    const next = repointSource(file, (path) => {
        const reached = resolve(dirname(file), path);
        return withoutExtension(reached) === withoutExtension(module)
            ? `${withoutExtension(pathFrom(dirname(file), target))}${extensionOf(path)}`
            : undefined;
    });
    if (next !== text) {
        writeFileSync(file, next);
    }
}

export function fixSetupModuleAtLowestCommonFolder(rootDir: string): string[] {
    const moved: string[] = [];
    const movedTo = new Map<string, string>();
    for (const specsRoot of findSpecsRoots(rootDir)) {
        for (const misplaced of misplacedUnder(specsRoot)) {
            if (misplaced.kind === 'inline' || existsSync(misplaced.target)) {
                continue;
            }
            const { module, readers, setup, target } = misplaced;
            rewriteOwnImports(module, target);
            mkdirSync(dirname(target), { recursive: true });
            moveKeepingHistory(module, target);
            movedTo.set(module, target);
            for (const reader of readers) {
                repointImporter(movedTo.get(reader) ?? reader, module, target);
            }
            removeIfEmpty(dirname(module));
            removeIfEmpty(setup);
            moved.push(`${relative(rootDir, module)} → ${relative(rootDir, target)}`);
        }
    }
    return moved;
}
