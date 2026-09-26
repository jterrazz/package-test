import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

import { treeNames } from '../../engine/project/git-tree.js';
import { SETUP_FOLDER } from '../../engine/project/ground.js';
import {
    COMPONENT_TREE,
    declaresTests,
    isRunnerName,
    isTestOrSpecName,
    modulesUnder,
    refusedReservedAbove,
    setupFolderOf,
} from '../../engine/project/specs-modules.js';
import { findSpecsRoots, reservedFolderOf } from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

const FIXTURES_MODULE = /\.fixtures\.[cm]?[jt]sx?$/u;

const TEST_BESIDE = ['.test.ts', '.test.tsx'];

function stemOf(name: string): string {
    return name.replace(/\.[cm]?[jt]sx?$/u, '');
}

function isUnitUnderTest(file: string): boolean {
    const stem = join(dirname(file), stemOf(basename(file)));
    return TEST_BESIDE.some((suffix) => existsSync(`${stem}${suffix}`));
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

function setupTargetOf(specsRoot: string, file: string): string {
    const subject = subjectOf(specsRoot, file);
    const home = reservedFolderOf(specsRoot, subject, SETUP_FOLDER);
    return relative(specsRoot, join(home, relative(subject, file)));
}

function codeOutsideSetup(rootDir: string, specsRoot: string): Finding[] {
    const found: Finding[] = [];
    for (const file of modulesUnder(specsRoot)) {
        const name = basename(file);
        const rel = relative(specsRoot, file);
        const shown = relative(rootDir, file);
        if (FIXTURES_MODULE.test(name)) {
            const home =
                setupFolderOf(specsRoot, file) === undefined
                    ? dirname(setupTargetOf(specsRoot, file))
                    : dirname(rel);
            found.push({
                file: shown,
                line: 1,
                fix: `name the module for what it holds and move it into the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — \`specs/${home}/<meaning>.ts\` — and the paths that import it`,
                found: `\`${name}\` under specs/: a fixture is input data, a file in \`_fixtures/\`, never a module`,
                rule: 'spec-code-in-setup-folder',
                severity: 'error',
            });
            continue;
        }
        if (
            isTestOrSpecName(name) ||
            isRunnerName(name) ||
            dirname(file) === specsRoot ||
            rel.split(sep)[0] === COMPONENT_TREE ||
            setupFolderOf(specsRoot, file) !== undefined ||
            refusedReservedAbove(specsRoot, file) !== undefined ||
            isUnitUnderTest(file)
        ) {
            continue;
        }
        found.push({
            file: shown,
            line: 1,
            fix: `move it to \`specs/${setupTargetOf(specsRoot, file)}\` — the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — and the paths that import it`,
            found: `\`${name}\`, code that prepares specs outside every \`${SETUP_FOLDER}/\``,
            rule: 'spec-code-in-setup-folder',
            severity: 'error',
        });
    }
    return found;
}

export function checkSpecCodeInSetupFolder(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => codeOutsideSetup(rootDir, specsRoot));
}
