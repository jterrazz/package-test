import { SETUP_FOLDER, treeKind, treeNames } from '@jterrazz/typescript/rules';
import { basename, dirname, join, relative } from 'node:path';

import {
    declaresTests,
    isRunnerName,
    isTestOrSpecName,
    lowestPlaceOf,
    modulesUnder,
    readersOf,
    refusedReservedAbove,
    setupFolderOf,
} from '../../kit/project/specs-modules.js';
import { findSpecsRoots, reservedFolderOf } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

const FIXTURES_MODULE = /\.fixtures\.[cm]?[jt]sx?$/u;

const RENDERED_BY = '.test.tsx';

function isRenderedUnit(file: string): boolean {
    // Stryker disable next-line Regex: a module's name ends on its extension
    return treeKind(`${file.replace(/\.[cm]?[jt]sx?$/u, '')}${RENDERED_BY}`) === 'file';
}

function holdsASpecDirectly(folder: string): boolean {
    return treeNames(folder).some((name) => declaresTests(name));
}

function subjectOf(specsRoot: string, file: string): string {
    let folder = dirname(file);
    while (folder !== specsRoot && dirname(folder) !== specsRoot && !holdsASpecDirectly(folder)) {
        folder = dirname(folder);
    }
    return folder;
}

function setupTargetOf(specsRoot: string, file: string, readers: readonly string[]): string {
    const subject = subjectOf(specsRoot, file);
    const owner = lowestPlaceOf(specsRoot, readers) ?? subject;
    const home = reservedFolderOf(specsRoot, owner, SETUP_FOLDER);
    return relative(specsRoot, join(home, relative(subject, file)));
}

function codeOutsideSetup(rootDir: string, specsRoot: string): Spotted[] {
    const found: Spotted[] = [];
    const modules = modulesUnder(specsRoot);
    const readers = readersOf(modules);
    for (const file of modules) {
        const read = readers.get(file) ?? [];
        const name = basename(file);
        const rel = relative(specsRoot, file);
        const shown = relative(rootDir, file);
        if (FIXTURES_MODULE.test(name)) {
            const home =
                setupFolderOf(specsRoot, file) === undefined
                    ? dirname(setupTargetOf(specsRoot, file, read))
                    : dirname(rel);
            found.push({
                path: shown,
                line: 1,
                fix: `name the module for what it holds and move it into the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — \`specs/${home}/<meaning>.ts\` — and the paths that import it`,
                found: `\`${name}\` under specs/: a fixture is input data, a file in \`_fixtures/\`, never a module`,
                rule: 'spec-code-in-setup-folder',
            });
            continue;
        }
        if (
            isTestOrSpecName(name) ||
            isRunnerName(name) ||
            dirname(file) === specsRoot ||
            setupFolderOf(specsRoot, file) !== undefined ||
            refusedReservedAbove(specsRoot, file) !== undefined ||
            isRenderedUnit(file)
        ) {
            continue;
        }
        found.push({
            path: shown,
            line: 1,
            fix: `move it to \`specs/${setupTargetOf(specsRoot, file, read)}\` — the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — and the paths that import it`,
            found: `\`${name}\`, code that prepares specs outside every \`${SETUP_FOLDER}/\``,
            rule: 'spec-code-in-setup-folder',
        });
    }
    return found;
}

export function checkSpecCodeInSetupFolder(rootDir: string): Spotted[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => codeOutsideSetup(rootDir, specsRoot));
}
