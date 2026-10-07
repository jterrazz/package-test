import { isGroundFolder, moveKeepingHistory, treeKind } from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { pathFrom, quotedLiterals, relativeLiterals } from '../../kit/checker/repoint.js';
import { moduleTestsOf } from '../../kit/project/module-tests.js';
import { anchoredPaths, collectFixtureReferences } from '../../kit/project/named-paths.js';
import { SETTINGS_FILE } from '../../kit/project/settings-file.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-grammar.js';
import { placeOf } from '../../kit/project/specs-modules.js';
import {
    DISK_CALL,
    findSpecsRoots,
    isDir,
    isWithin,
    listFiles,
    lowestCommonFolder,
    readText,
    removeIfEmpty,
} from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

type Entry = { entry: string; ground: string };

type Usage = Entry & { leaves: Set<string>; referrers: Set<string> };

type Misplaced = Entry & { lowest: string; referrers: string[]; spread: boolean };

function entryOf(specsRoot: string, target: string): Entry | undefined {
    const segments = relative(specsRoot, target).split(sep);
    const at = segments.findIndex((segment) => isGroundFolder(segment));
    const entry = segments[at + 1];
    if (at === -1 || entry === undefined) {
        return undefined;
    }
    return { entry, ground: join(specsRoot, ...segments.slice(0, at + 1)) };
}

const WHOLE_LITERAL = /^(?:\.\/)?specs\/[^\s]*$/gu;

const WORD_IN_LITERAL = /(?<=^|\s)(?:\.\/)?specs\/[\w./@-]+/gu;

function memberAnchoredLiterals(member: string, file: string, pattern: RegExp): string[] {
    return quotedLiterals(readText(file)).flatMap(({ value }) =>
        [...value.matchAll(pattern)].map(([path]) => resolve(member, path)),
    );
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
    return moduleTestsOf(member).flatMap((file) =>
        relativeLiterals(readText(file))
            .map(({ value }) => resolve(dirname(file), value))
            .concat(
                anchoredPaths(file).map(({ target }) => target),
                memberAnchoredLiterals(member, file, WHOLE_LITERAL),
            ),
    );
}

const MAKEFILE_PATH = /(?<![\w./-])(?:\.\/)?specs\/[\w./@-]+/gu;

// invariant: a missing file reads as empty, and so names nothing.
function pathsMemberConfigsName(member: string): string[] {
    return [
        ...[...readText(join(member, 'Makefile')).matchAll(MAKEFILE_PATH)].map(([path]) =>
            resolve(member, path),
        ),
        ...memberAnchoredLiterals(member, join(member, SETTINGS_FILE), WORD_IN_LITERAL),
    ];
}

function misplacedGround(rootDir: string): Misplaced[] {
    const misplaced: Misplaced[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        const readOutside = new Set(
            [
                ...pathsModuleTestsName(dirname(specsRoot)),
                ...pathsMemberConfigsName(dirname(specsRoot)),
            ]
                .map((path) => entryOf(specsRoot, path))
                .filter((found) => found !== undefined)
                .map(({ entry, ground }) => join(ground, entry)),
        );
        for (const [key, { entry, ground, leaves, referrers }] of usageUnder(specsRoot)) {
            const lowest = lowestCommonFolder([...leaves]) ?? specsRoot;
            const owner = dirname(ground);
            if (!isWithin(owner, lowest) || readOutside.has(key) || treeKind(key) === undefined) {
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

export function checkGroundPlacement(rootDir: string): Spotted[] {
    return misplacedGround(rootDir).map(({ entry, ground, lowest, spread }) => {
        const role = basename(ground);
        const home = `${relative(rootDir, lowest)}/${role}/${entry}`;
        const named = isDir(join(ground, entry))
            ? `directory('./${role}/${entry}/')`
            : `file('./${role}/${entry}')`;
        return {
            path: relative(rootDir, join(ground, entry)),
            line: 1,
            fix: spread
                ? `move it to ${home}, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it — \`typescript fix\` does both`
                : `move it to ${home} and name it ${named} — \`typescript fix\` does both`,
            found: spread
                ? `ground only the leaves under ${relative(rootDir, lowest)} reach for, kept above them`
                : `ground only ${relative(rootDir, lowest)} reaches for, kept above it`,
            rule: 'ground-shared-or-inline',
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
            const down = pathFrom(dirname(file), join(lowest, role));
            writeFileSync(file, text.replaceAll(`${climb}/${entry}`, `${down}/${entry}`));
        }
        removeIfEmpty(ground);
        moved.push(`${relative(rootDir, join(ground, entry))} → ${relative(rootDir, destination)}`);
    }
    return moved;
}
