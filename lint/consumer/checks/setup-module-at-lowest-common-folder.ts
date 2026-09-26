import { basename, dirname, join, relative, sep } from 'node:path';

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
    reservedFolderOf,
} from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

const STUBS_FOLDER = 'stubs';

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

function misplacedSetup(rootDir: string, specsRoot: string): Finding[] {
    const modules = modulesUnder(specsRoot);
    const readers = readersOf(modules);
    const found: Finding[] = [];
    for (const module of modules) {
        const setup = setupFolderOf(specsRoot, module);
        const read = readers.get(module) ?? [];
        if (setup === undefined || read.length === 0) {
            continue;
        }
        const rel = relative(specsRoot, module);
        const [only] = read;
        if (
            read.length === 1 &&
            only !== undefined &&
            isTestOrSpecName(basename(only)) &&
            !isStubs(setup, module) &&
            linesOf(only) + linesOf(module) <= MAX_SPEC_LINES
        ) {
            found.push({
                file: relative(rootDir, module),
                line: 1,
                fix: `write what it holds in \`specs/${relative(specsRoot, only)}\`, and delete the module — a \`${SETUP_FOLDER}/\` module exists only while several read it`,
                found: `\`specs/${rel}\`, read by \`${basename(only)}\` alone`,
                rule: 'setup-module-at-lowest-common-folder',
                severity: 'error',
            });
            continue;
        }
        const lowest = lowestCommonFolder(read.map((reader) => placeOf(specsRoot, reader)));
        if (lowest === undefined) {
            continue;
        }
        const home = reservedFolderOf(specsRoot, lowest, SETUP_FOLDER);
        if (home === setup) {
            continue;
        }
        const moved = relative(specsRoot, join(home, relative(setup, module)));
        found.push({
            file: relative(rootDir, module),
            line: 1,
            fix: `move it to \`specs/${moved}\` — the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — and the paths that import it`,
            found: `\`specs/${rel}\`, whose readers share \`${shown(specsRoot, lowest)}\`, not \`${shown(specsRoot, ownerOfSetup(specsRoot, setup))}\``,
            rule: 'setup-module-at-lowest-common-folder',
            severity: 'error',
        });
    }
    return found;
}

export function checkSetupModuleAtLowestCommonFolder(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => misplacedSetup(rootDir, specsRoot));
}
