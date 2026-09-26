import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { relativeLiterals } from '../../engine/checker/repoint.js';
import { moveKeepingHistory, treeKind } from '../../engine/project/git-tree.js';
import { isGroundName, SHARED_FOLDER } from '../../engine/project/ground.js';
import { moduleTestsOf } from '../../engine/project/module-tests.js';
import { SPEC_EXTENSION } from '../../engine/project/spec-document.js';
import { literalSpans } from '../../engine/project/spec-values.js';
import { placeOf } from '../../engine/project/specs-modules.js';
import {
    anchoredPaths,
    blankComments,
    collectFixtureReferences,
    DISK_CALL,
    findSpecsRoots,
    isDir,
    isWithin,
    listFiles,
    lowestCommonFolder,
    readText,
    removeIfEmpty,
} from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

type Entry = { entry: string; ground: string };

type Usage = Entry & { leaves: Set<string>; referrers: Set<string> };

type Misplaced = Entry & { lowest: string; referrers: string[]; spread: boolean };

function entryOf(specsRoot: string, target: string): Entry | undefined {
    const segments = relative(specsRoot, target).split(sep);
    const at = segments.findIndex((segment) => isGroundName(segment));
    const entry = segments[at + 1];
    if (at === -1 || entry === undefined || entry === '' || segments[0] === '..') {
        return undefined;
    }
    return { entry, ground: join(specsRoot, ...segments.slice(0, at + 1)) };
}

function ownerOf(specsRoot: string, ground: string): string | undefined {
    const owner = dirname(ground);
    if (owner === specsRoot) {
        return undefined;
    }
    return owner === join(specsRoot, SHARED_FOLDER) ? specsRoot : owner;
}

const WHOLE_LITERAL = /^(?:\.\/)?specs\/[^\s]*$/gu;

const WORD_IN_LITERAL = /(?<=^|\s)(?:\.\/)?specs\/[\w./@-]+/gu;

function memberAnchoredLiterals(member: string, file: string, pattern: RegExp): string[] {
    const scanned = blankComments(readText(file));
    return literalSpans(scanned).flatMap(({ end, start }) => {
        const value = scanned.slice(start + 1, end - 1);
        const quoted = `'"\``.includes(scanned[start] ?? '') && !value.includes('${');
        return quoted ? [...value.matchAll(pattern)].map(([path]) => resolve(member, path)) : [];
    });
}

function pathsNamedIn(member: string, file: string): string[] {
    const found = collectFixtureReferences(file, DISK_CALL, true).map(({ path }) =>
        resolve(dirname(file), path),
    );
    if (file.endsWith(SPEC_EXTENSION)) {
        return found;
    }
    const literals = relativeLiterals(readText(file)).map(({ value }) =>
        resolve(dirname(file), value),
    );
    return found.concat(
        literals,
        anchoredPaths(file).map(({ target }) => target),
        memberAnchoredLiterals(member, file, WORD_IN_LITERAL),
    );
}

function usageUnder(specsRoot: string): Map<string, Usage> {
    const usage = new Map<string, Usage>();
    const referrers = listFiles(
        specsRoot,
        (path) => /\.[cm]?[jt]sx?$/u.test(path) || path.endsWith(SPEC_EXTENSION),
    );
    for (const file of referrers) {
        const place = placeOf(specsRoot, file);
        for (const path of new Set(pathsNamedIn(dirname(specsRoot), file))) {
            const found = entryOf(specsRoot, path);
            if (found === undefined) {
                continue;
            }
            const key = join(found.ground, found.entry);
            const held = usage.get(key) ?? { ...found, leaves: new Set(), referrers: new Set() };
            held.leaves.add(place);
            held.referrers.add(file);
            usage.set(key, held);
        }
    }
    return usage;
}

/** A module test reads its ground from outside every leaf, so what it names is shared, whatever the specs say. */
export function pathsModuleTestsName(member: string): string[] {
    const named: string[] = [];
    for (const file of moduleTestsOf(member)) {
        for (const { value } of relativeLiterals(readText(file))) {
            named.push(resolve(dirname(file), value));
        }
        for (const { target } of anchoredPaths(file)) {
            named.push(target);
        }
        named.push(...memberAnchoredLiterals(member, file, WHOLE_LITERAL));
    }
    return named;
}

const MAKEFILE_PATH = /(?<![\w./-])(?:\.\/)?specs\/[\w./@-]+/gu;

const VITEST_CONFIGS = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js'];

function pathsMemberConfigsName(member: string): string[] {
    const makefile = join(member, 'Makefile');
    const fromMakefile =
        treeKind(makefile) === 'file'
            ? [...readText(makefile).matchAll(MAKEFILE_PATH)].map(([path]) => resolve(member, path))
            : [];
    const fromVitest = VITEST_CONFIGS.map((name) => join(member, name))
        .filter((file) => treeKind(file) === 'file')
        .flatMap((file) => memberAnchoredLiterals(member, file, WORD_IN_LITERAL));
    return fromMakefile.concat(fromVitest);
}

function misplacedGround(rootDir: string): Misplaced[] {
    const misplaced: Misplaced[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        const readOutside = new Set(
            [
                ...pathsModuleTestsName(dirname(specsRoot)),
                ...pathsMemberConfigsName(dirname(specsRoot)),
            ].flatMap((path) => {
                const found = entryOf(specsRoot, path);
                return found === undefined ? [] : [join(found.ground, found.entry)];
            }),
        );
        for (const [key, { entry, ground, leaves, referrers }] of usageUnder(specsRoot)) {
            const lowest = lowestCommonFolder([...leaves]);
            const owner = ownerOf(specsRoot, ground);
            if (
                lowest === undefined ||
                owner === undefined ||
                !isWithin(owner, lowest) ||
                readOutside.has(key) ||
                treeKind(key) === undefined
            ) {
                continue;
            }
            misplaced.push({
                entry,
                ground,
                lowest,
                referrers: [...referrers],
                spread: [...leaves].some((leaf) => leaf !== lowest),
            });
        }
    }
    return misplaced;
}

export function checkGroundPlacement(rootDir: string): Finding[] {
    return misplacedGround(rootDir).map(({ entry, ground, lowest, spread }) => {
        const role = basename(ground);
        const home = `${relative(rootDir, lowest)}/${role}/${entry}`;
        const named = isDir(join(ground, entry))
            ? `directory('./${role}/${entry}/')`
            : `file('./${role}/${entry}')`;
        return {
            file: relative(rootDir, join(ground, entry)),
            line: 1,
            fix: spread
                ? `move it to ${home}, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it — \`make fix\` does both`
                : `move it to ${home} and name it ${named} — \`make fix\` does both`,
            found: spread
                ? `ground only the leaves under ${relative(rootDir, lowest)} reach for, kept above them`
                : `ground only ${relative(rootDir, lowest)} reaches for, kept above it`,
            rule: 'ground-shared-or-inline',
            severity: 'error',
        };
    });
}

export function fixGroundPlacement(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { entry, ground, lowest, referrers } of misplacedGround(rootDir)) {
        const role = basename(ground);
        const destination = join(lowest, role, entry);
        if (existsSync(destination)) {
            continue;
        }
        mkdirSync(dirname(destination), { recursive: true });
        moveKeepingHistory(join(ground, entry), destination);
        for (const file of referrers) {
            const text = readText(file);
            const climb = relative(dirname(file), ground).split(sep).join('/');
            const down = relative(dirname(file), join(lowest, role)).split(sep).join('/');
            const next = text.replaceAll(
                `${climb}/${entry}`,
                `${down.startsWith('.') ? down : `./${down}`}/${entry}`,
            );
            if (next !== text) {
                writeFileSync(file, next);
            }
        }
        removeIfEmpty(ground);
        if (basename(dirname(ground)) === SHARED_FOLDER) {
            removeIfEmpty(dirname(ground));
        }
        moved.push(`${relative(rootDir, join(ground, entry))} → ${relative(rootDir, destination)}`);
    }
    return moved;
}
