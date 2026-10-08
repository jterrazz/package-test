import { moveKeepingHistory, SETUP_FOLDER } from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { pathFrom, repointSource } from '../../kit/checker/repoint.js';
import {
    importsThroughAlias,
    isTestOrSpecName,
    lowestPlaceOf,
    MAX_SPEC_LINES,
    modulesUnder,
    readersOf,
    setupFolderOf,
} from '../../kit/project/specs-modules.js';
import {
    findSpecsRoots,
    readText,
    removeIfEmpty,
    reservedFolderOf,
} from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

const STUBS_FOLDER = 'stubs';

const MODULE_EXTENSION = /\.[cm]?[jt]sx?$/u;

type Misplaced =
    | {
          aliased: boolean;
          module: string;
          inline: false;
          lowest: string;
          readers: string[];
          setup: string;
          specsRoot: string;
          target: string;
      }
    | { inline: true; module: string; only: string; specsRoot: string };

function shown(specsRoot: string, folder: string): string {
    return folder === specsRoot ? `specs/` : `specs/${relative(specsRoot, folder)}/`;
}

function linesOf(file: string): number {
    return readText(file).split('\n').length;
}

function isStubs(setup: string, module: string): boolean {
    return relative(setup, module).split(sep).includes(STUBS_FOLDER);
}

function belongsInItsReader(setup: string, module: string, reader: string): boolean {
    return (
        isTestOrSpecName(basename(reader)) &&
        !isStubs(setup, module) &&
        linesOf(reader) + linesOf(module) <= MAX_SPEC_LINES
    );
}

function misplacedUnder(specsRoot: string): Misplaced[] {
    const modules = modulesUnder(specsRoot);
    const readers = readersOf(modules);
    const found: Misplaced[] = [];
    for (const module of modules) {
        const setup = setupFolderOf(specsRoot, module);
        const read = readers.get(module);
        if (setup === undefined || read === undefined) {
            continue;
        }
        const only = String(read[0]);
        if (read.length === 1 && belongsInItsReader(setup, module, only)) {
            found.push({ inline: true, module, only, specsRoot });
            continue;
        }
        const lowest = lowestPlaceOf(specsRoot, read);
        // Stryker disable next-line ConditionalExpression,BlockStatement: the readers of a module all sit in its specs tree, which they share
        if (lowest === undefined) {
            continue;
        }
        const home = reservedFolderOf(lowest, SETUP_FOLDER);
        if (home !== setup) {
            const target = join(home, relative(setup, module));
            const aliased = read.some((reader) => importsThroughAlias(reader, module));
            found.push({
                aliased,
                inline: false,
                lowest,
                module,
                readers: read,
                setup,
                specsRoot,
                target,
            });
        }
    }
    return found;
}

function findingOf(rootDir: string, misplaced: Misplaced): Spotted {
    const { module, specsRoot } = misplaced;
    const rel = relative(specsRoot, module);
    if (misplaced.inline) {
        return {
            path: relative(rootDir, module),
            line: 1,
            fix: `write what it holds in \`specs/${relative(specsRoot, misplaced.only)}\`, and delete the module — a \`${SETUP_FOLDER}/\` module exists only while several read it`,
            found: `\`specs/${rel}\`, read by \`${basename(misplaced.only)}\` alone`,
            rule: 'setup-module-at-lowest-common-folder',
        };
    }
    return {
        path: relative(rootDir, module),
        line: 1,
        fix: misplaced.aliased
            ? `move it to \`specs/${relative(specsRoot, misplaced.target)}\` — the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — and the \`imports\` alias that reaches it, by hand: \`typescript fix\` moves no module an alias reaches`
            : `move it to \`specs/${relative(specsRoot, misplaced.target)}\` — the \`${SETUP_FOLDER}/\` of the lowest folder its readers share — and the paths that import it; \`typescript fix\` does both`,
        found: `\`specs/${rel}\`, whose readers share \`${shown(specsRoot, misplaced.lowest)}\`, not \`${shown(specsRoot, dirname(misplaced.setup))}\``,
        rule: 'setup-module-at-lowest-common-folder',
    };
}

export function checkSetupModuleAtLowestCommonFolder(rootDir: string): Spotted[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) =>
        misplacedUnder(specsRoot).map((misplaced) => findingOf(rootDir, misplaced)),
    );
}

function withoutExtension(path: string): string {
    return path.replace(MODULE_EXTENSION, '');
}

function extensionOf(path: string): string {
    return MODULE_EXTENSION.exec(path)?.[0] ?? '';
}

// invariant: a path built from the module's own folder by pieces (`resolve(import.meta.dirname, '..', '..')`) names the same place after the move: the climb is recounted from the new folder.
const CLIMB =
    /(?<anchor>import\.meta\.dirname|__dirname)(?<pieces>(?:\s*,\s*(?<quote>['"])\.\.\k<quote>)+)/gu;

function reclimbed(module: string, target: string, text: string): string {
    return text.replaceAll(CLIMB, (_whole: string, anchor: string, pieces: string) => {
        const climb = pieces.split(',').slice(1);
        const reached = resolve(dirname(module), ...climb.map(() => '..'));
        // invariant: the mover lays a module in another folder's __setup__/, never in a folder its own climb reaches, so a recounted climb is never empty.
        const steps = relative(dirname(target), reached).split(sep);
        return [anchor, ...steps.map((step) => `'${step}'`)].join(', ');
    });
}

function rewriteOwnImports(module: string, target: string): void {
    const next = repointSource(module, (path) => {
        const reached = resolve(dirname(module), path);
        return pathFrom(dirname(target), reached);
    });
    writeFileSync(module, reclimbed(module, target, next));
}

function repointImporter(file: string, module: string, target: string): void {
    const text = readText(file);
    const next = repointSource(file, (path) => {
        const reached = resolve(dirname(file), path);
        return withoutExtension(reached) === withoutExtension(module)
            ? `${withoutExtension(pathFrom(dirname(file), target))}${extensionOf(path)}`
            : undefined;
    });
    // Stryker disable next-line ConditionalExpression: rewriting a file with its own bytes changes nothing but its mtime
    if (next !== text) {
        writeFileSync(file, next);
    }
}

export function fixSetupModuleAtLowestCommonFolder(rootDir: string): string[] {
    const moved: string[] = [];
    const movedTo = new Map<string, string>();
    for (const specsRoot of findSpecsRoots(rootDir)) {
        for (const misplaced of misplacedUnder(specsRoot)) {
            if (misplaced.inline || misplaced.aliased || existsSync(misplaced.target)) {
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
