import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { GROUND_FIXTURES, isGroundName, RENAMED_GROUND_DIRS } from '../src/model/chain/ground.js';
import { SPEC_EXTENSION } from '../src/model/literate/spec-document.js';

/**
 * The 16 → 17 mover — what `jterrazz-test-check <specs> --fix` does to a tree
 * written for 16.x.
 *
 * Two gestures, in this order:
 *
 * 1. every `_fixtures/`, `_expected/`, `_requests/`, `_seeds/` folder takes its
 *    bare name (C13), deepest first;
 * 2. every call and document names its file by the path from the spec:
 *    `.seed('x.sql')` → `.seedFile('./seeds/x.sql')`, `.request('x.http')` →
 *    `.requestFile('./requests/x.http')`, `.fixture('$FIXTURES/app/')` →
 *    `.fixtureDirectory('../../fixtures/app/')`, `toMatch('help.txt')` →
 *    `toMatchFile('./expected/help.txt')`, a golden tree → `toMatchDirectory`,
 *    and a document's `fixture:` the same way.
 *
 * Only LITERAL arguments move: a name computed at run time is out of static
 * reach, and the run that follows names each one the verb refuses. A
 * `toMatch` literal moves only when a golden of that name sits in the spec's
 * `expected/` — a string with no file behind it is a value, and stays one.
 */

/** What the mover did, relative to the tree it walked. */
export type Migration = { renamed: string[]; rewritten: string[] };

/** A rename, injected so the CLI can keep git's history of what it moves. */
export type Rename = (from: string, to: string) => void;

const SKIPPED = new Set(['.git', 'dist', 'node_modules']);

/** The groups every rewrite below captures. */
type Call = { quote: string; space: string; value: string };

/** The named groups of a `replaceAll` match — its last argument. */
function callOf(match: unknown[]): Call {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every pattern below declares these three groups, and a replacer's last argument IS the groups object
    return match.at(-1) as Call;
}

/** A quoted literal, captured with its quote. */
const LITERAL = String.raw`(?<quote>['"])(?<value>[^'"\n]*)\k<quote>`;

/** Every directory under `root` (itself excluded), deepest first. */
function directoriesDeepestFirst(root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory() && !SKIPPED.has(entry.name)) {
                const path = join(dir, entry.name);
                walk(path);
                found.push(path);
            }
        }
    };
    walk(root);
    return found.toSorted((a, b) => b.split(sep).length - a.split(sep).length);
}

/** Every file of the tree a spec may be written in — the pool and ground excluded. */
function specFiles(root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string, depth: number): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                const isPool = depth === 0 && entry.name === GROUND_FIXTURES;
                if (!SKIPPED.has(entry.name) && !isGroundName(entry.name) && !isPool) {
                    walk(path, depth + 1);
                }
            } else if (/\.[cm]?[jt]sx?$/u.test(entry.name) || entry.name.endsWith(SPEC_EXTENSION)) {
                found.push(path);
            }
        }
    };
    walk(root, 0);
    return found;
}

/** A relative path spelled from `from` to `to`, always starting `./` or `../`. */
function pathFrom(from: string, to: string): string {
    const path = relative(from, to).split(sep).join('/');
    return path.startsWith('..') ? path : `./${path}`;
}

/** The 17 path a 16 `.fixture()` argument (or `fixture:` entry) names, from `specDir`. */
function fixturePath(value: string, specDir: string, root: string): string | undefined {
    if (value.startsWith('./') || value.startsWith('../')) {
        return undefined;
    }
    if (value.startsWith('$FIXTURES/')) {
        return `${pathFrom(specDir, join(root, GROUND_FIXTURES))}/${value.slice('$FIXTURES/'.length)}`;
    }
    if (value.startsWith('$')) {
        return undefined;
    }
    return `./${GROUND_FIXTURES}/${value}`;
}

/** Is `path` a directory on disk? */
function isDirectoryAt(path: string): boolean {
    return existsSync(path) && statSync(path).isDirectory();
}

/** Rewrite the 16 calls of one source file; `root` is the specs tree. */
function migrateSource(text: string, file: string, root: string): string {
    const specDir = dirname(file);
    return text
        .replaceAll(new RegExp(String.raw`\.seed\((?<space>\s*)${LITERAL}`, 'gu'), (...match) => {
            const { quote, space, value } = callOf(match);
            return value.endsWith('.sql') && !value.startsWith('.')
                ? `.seedFile(${space}${quote}./seeds/${value}${quote}`
                : match[0];
        })
        .replaceAll(
            new RegExp(String.raw`\.request\((?<space>\s*)${LITERAL}`, 'gu'),
            (...match) => {
                const { quote, space, value } = callOf(match);
                return value.endsWith('.http') && !value.startsWith('.')
                    ? `.requestFile(${space}${quote}./requests/${value}${quote}`
                    : match[0];
            },
        )
        .replaceAll(
            new RegExp(String.raw`\.fixture\((?<space>\s*)${LITERAL}`, 'gu'),
            (...match) => {
                const { quote, space, value } = callOf(match);
                const path = fixturePath(value, specDir, root);
                if (path === undefined) {
                    return match[0];
                }
                const verb = value.endsWith('/') ? 'fixtureDirectory' : 'fixtureFile';
                return `.${verb}(${space}${quote}${path}${quote}`;
            },
        )
        .replaceAll(
            new RegExp(String.raw`\.toMatch\((?<space>\s*)${LITERAL}`, 'gu'),
            (...match) => {
                const { quote, space, value } = callOf(match);
                const name = value.replace(/\/+$/u, '');
                const golden = join(specDir, 'expected', name);
                if (name.length === 0 || !existsSync(golden)) {
                    return match[0];
                }
                return isDirectoryAt(golden)
                    ? `.toMatchDirectory(${space}${quote}./expected/${name}/${quote}`
                    : `.toMatchFile(${space}${quote}./expected/${name}${quote}`;
            },
        );
}

/** Rewrite the `fixture:` entries of one document. */
function migrateDocument(text: string, file: string, root: string): string {
    const specDir = dirname(file);
    let inList = false;
    return text
        .split('\n')
        .map((line) => {
            const scalar = /^fixture:\s*(?<value>\S.*)$/u.exec(line);
            if (scalar?.groups?.value !== undefined) {
                inList = false;
                const path = fixturePath(scalar.groups.value.trim(), specDir, root);
                return path === undefined ? line : `fixture: ${path}`;
            }
            if (/^fixture:\s*$/u.test(line)) {
                inList = true;
                return line;
            }
            const item = /^(?<lead>\s+-\s+)(?<value>\S.*)$/u.exec(line);
            if (inList && item?.groups?.value !== undefined) {
                const path = fixturePath(item.groups.value.trim(), specDir, root);
                return path === undefined ? line : `${item.groups.lead}${path}`;
            }
            inList = false;
            return line;
        })
        .join('\n');
}

/** The spelling of an already-relative path that still names a 16 folder. */
const OLD_SEGMENT = /(?<=['"/ ])_(?<name>fixtures|expected|requests|seeds)(?=\/)/gu;

/**
 * Apply the 16 → 17 migration to a specs tree. Idempotent: a tree already on
 * 17 is left as it is.
 */
export function migrateTo17(root: string, rename: Rename): Migration {
    const renamed: string[] = [];
    for (const dir of directoriesDeepestFirst(root)) {
        const bare = RENAMED_GROUND_DIRS[dir.split(sep).at(-1) ?? ''];
        const target = bare === undefined ? undefined : join(dirname(dir), bare);
        if (target !== undefined && !existsSync(target)) {
            rename(dir, target);
            renamed.push(`${relative(root, dir)} → ${relative(root, target)}`);
        }
    }
    const rewritten: string[] = [];
    for (const file of specFiles(root)) {
        const text = readFileSync(file, 'utf8');
        const moved = file.endsWith(SPEC_EXTENSION)
            ? migrateDocument(text, file, root)
            : migrateSource(text, file, root);
        const next = moved.replaceAll(OLD_SEGMENT, '$<name>');
        if (next !== text) {
            writeFileSync(file, next);
            rewritten.push(relative(root, file));
        }
    }
    return { renamed, rewritten };
}
