import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { GROUND_FIXTURES, isGroundName, RENAMED_GROUND_DIRS } from '../src/model/chain/ground.js';
import { SPEC_EXTENSION } from '../src/model/literate/spec-document.js';
import { isTestFileName } from './role.js';

/**
 * The 16 → 17 mover — what `jterrazz-test-check --fix` does to a tree written
 * for 16.x.
 *
 * It runs only on what C13 still finds 16.x-shaped: a tree holding at least
 * one `_fixtures/`, `_expected/`, `_requests/` or `_seeds/` folder. A tree
 * with none is on 17 and is left exactly as it is — its bare strings are
 * values, or the deliberate refusals a negative spec exists to keep. Two trees
 * are walked: a `specs/` tree, and the module tests of a member (every test
 * outside `specs/`, never ground, never a nested package), each judged 16 or
 * 17 on its own folders.
 *
 * Its gestures, in this order:
 *
 * 1. every 16 ground folder takes its bare name (C13), deepest first;
 * 2. every call names the disk with `file()` or `directory()`, by the path from
 *    the spec: `.seed('x.sql')` → `.seed(file('./seeds/x.sql'))`,
 *    `.request('x.http')` → `.request(file('./requests/x.http'))`,
 *    `.fixture('$FIXTURES/app/')` → `.fixture(directory('../../fixtures/app/'))`,
 *    `.fixture('x.toml')` → `.fixture(file('./fixtures/x.toml'))`,
 *    `toMatch('help.txt')` → `toMatch(file('./expected/help.txt'))`, a golden
 *    tree → `toMatch(directory('./expected/<name>/'))`, `.run('x.spec.yaml')` →
 *    `.run(file('./x.spec.yaml'))` — and a document's `fixture:` names its path
 *    the same way;
 * 3. a stream compared as a VALUE reads its text: 16 overrode `toContain` and
 *    `toMatch` on a stream accessor, 17 leaves both to vitest, so
 *    `expect(result.stdout).toContain('x')` → `expect(result.stdout.text).toContain('x')`
 *    (`.not` included, a `.grep(…)` subject too; a `toMatch(file(…))` golden
 *    stays on the accessor);
 * 4. a source the second gesture touched imports the two names it now calls.
 *
 * The `…File`/`…Directory` verbs of the 17 prototype are read too
 * (`.seedFile('./seeds/x.sql')` → `.seed(file('./seeds/x.sql'))`), so a tree
 * caught between the two moves in one run.
 *
 * Only LITERAL arguments move: a name computed at run time is out of static
 * reach, and the run that follows names each one the verb refuses. A 16
 * `toMatch` literal moves only when a golden of that name sits in the spec's
 * `expected/` — a string with no file behind it is a value, and stays one.
 */

/** What the mover did, relative to the tree it walked. */
export type Migration = { renamed: string[]; rewritten: string[] };

/** A rename, injected so the CLI can keep git's history of what it moves. */
export type Rename = (from: string, to: string) => void;

const SKIPPED = new Set(['.artifacts', '.git', 'coverage', 'dist', 'node_modules']);

/** The groups every rewrite below captures. */
type Call = { quote: string; space: string; value: string };

/** The named groups of a `replaceAll` match — its last argument. */
function callOf(match: unknown[]): Call {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every pattern below declares these three groups, and a replacer's last argument IS the groups object
    return match.at(-1) as Call;
}

/** A quoted literal, captured with its quote. */
const LITERAL = '(?<quote>[\'"`])(?<value>[^\'"`\\n]*)\\k<quote>';

/**
 * Every 16.x ground folder of the tree, deepest first. The walk never enters
 * ground — a 16 folder or a bare one: what sits inside is material a spec
 * stands on (a fixture project's own `specs/` tree included), and renaming in
 * there would rewrite the input a negative spec exists to keep.
 */
function oldGroundFolders(root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory() || SKIPPED.has(entry.name)) {
                continue;
            }
            const path = join(dir, entry.name);
            if (RENAMED_GROUND_DIRS[entry.name] !== undefined) {
                found.push(path);
            } else if (!isGroundName(entry.name)) {
                walk(path);
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

/** A literal the mover may rewrite: no interpolation to evaluate. */
function isPlain(value: string): boolean {
    return !value.includes('${');
}

/** `.<verb>(<space><quote><value><quote>` → `.<next>(<space><wrap>(<quote><path><quote>)`. */
function wrapped(next: string, wrap: string, { quote, space }: Call, path: string): string {
    return `.${next}(${space}${wrap}(${quote}${path}${quote})`;
}

/** The prototype's `…File`/`…Directory` verbs → the simple verb and the wrapper it takes. */
const PROTOTYPE_VERBS: Record<string, [verb: string, wrap: string]> = {
    fixtureDirectory: ['fixture', 'directory'],
    fixtureFile: ['fixture', 'file'],
    requestFile: ['request', 'file'],
    seedFile: ['seed', 'file'],
    toMatchDirectory: ['toMatch', 'directory'],
    toMatchFile: ['toMatch', 'file'],
};

/**
 * A stream accessor handed to `expect()` whole — the result members that are
 * text in every facet, with any `.grep(…)` after them. `body` and `value` are
 * out: on an api or integration result they are json as often as text.
 */
const STREAM_VALUE =
    /expect\((?<space>\s*)(?<subject>[\w$.]*?\.(?:content|console|error|errors|html|stderr|stdout|title|tree)(?:\.grep\([^()]*\))*)(?<close>\s*,?\s*\))(?<not>(?:\.not)?)\.(?<matcher>toContain|toMatch)\((?!\s*(?:directory|file)\()/gu;

/** Rewrite the 16 (and prototype) calls of one source file; `root` is the specs tree. */
function migrateSource(text: string, file: string, root: string): string {
    return migrateVerbs(text, file, root).replaceAll(
        STREAM_VALUE,
        'expect($<space>$<subject>.text$<close>$<not>.$<matcher>(',
    );
}

/** The verbs that name the disk, moved to `file()`/`directory()`. */
function migrateVerbs(text: string, file: string, root: string): string {
    const specDir = dirname(file);
    return text
        .replaceAll(
            new RegExp(
                String.raw`\.(?<verb>${Object.keys(PROTOTYPE_VERBS).join('|')})\((?<space>\s*)${LITERAL}`,
                'gu',
            ),
            (...match) => {
                const call = callOf(match);
                const { value } = call;
                const [verb, wrap] = PROTOTYPE_VERBS[String(match[1])] ?? [];
                return verb === undefined || wrap === undefined
                    ? match[0]
                    : wrapped(verb, wrap, call, value);
            },
        )
        .replaceAll(new RegExp(String.raw`\.seed\((?<space>\s*)${LITERAL}`, 'gu'), (...match) => {
            const call = callOf(match);
            const { value } = call;
            return value.endsWith('.sql') && !value.startsWith('.') && isPlain(value)
                ? wrapped('seed', 'file', call, `./seeds/${value}`)
                : match[0];
        })
        .replaceAll(
            new RegExp(String.raw`\.request\((?<space>\s*)${LITERAL}`, 'gu'),
            (...match) => {
                const call = callOf(match);
                const { value } = call;
                return value.endsWith('.http') && !value.startsWith('.') && isPlain(value)
                    ? wrapped('request', 'file', call, `./requests/${value}`)
                    : match[0];
            },
        )
        .replaceAll(
            new RegExp(String.raw`\.fixture\((?<space>\s*)${LITERAL}`, 'gu'),
            (...match) => {
                const call = callOf(match);
                const { value } = call;
                const path = isPlain(value) ? fixturePath(value, specDir, root) : undefined;
                if (path === undefined) {
                    return match[0];
                }
                return wrapped('fixture', path.endsWith('/') ? 'directory' : 'file', call, path);
            },
        )
        .replaceAll(
            new RegExp(String.raw`\.toMatch\((?<space>\s*)${LITERAL}`, 'gu'),
            (...match) => {
                const call = callOf(match);
                const { value } = call;
                const name = value.replace(/\/+$/u, '');
                const golden = join(specDir, 'expected', name);
                if (name.length === 0 || !isPlain(value) || !existsSync(golden)) {
                    return match[0];
                }
                return isDirectoryAt(golden)
                    ? wrapped('toMatch', 'directory', call, `./expected/${name}/`)
                    : wrapped('toMatch', 'file', call, `./expected/${name}`);
            },
        )
        .replaceAll(new RegExp(String.raw`\.run\((?<space>\s*)${LITERAL}`, 'gu'), (...match) => {
            const call = callOf(match);
            const { value } = call;
            if (!value.endsWith(SPEC_EXTENSION) || !isPlain(value)) {
                return match[0];
            }
            const path = value.startsWith('./') || value.startsWith('../') ? value : `./${value}`;
            return wrapped('run', 'file', call, path);
        });
}

/** A call of one of the two wrappers — never a result accessor (`result.file(…)`). */
const WRAPPER_CALL = /(?<![.\w])(?<name>directory|file)\(/gu;

/** The names a named import brings in, and where its braces sit. */
const NAMED_IMPORT =
    /^import\s*\{(?<names>[^}]*)\}\s*from\s*(?<quote>['"])(?<from>[^'"]+)\k<quote>;?/gmu;

/** Is this the specifier of the package's own entry — published, or this repository's source? */
function isEntry(from: string): boolean {
    return from === '@jterrazz/test' || /(?:^|\/)src\/index\.js$/u.test(from);
}

/**
 * The specifier this file should import the wrappers from: the entry its
 * specification file imports `specification` from, rebased onto this file —
 * a consumer's `@jterrazz/test`, or a repository's own source entry.
 */
function entryFor(text: string, file: string): string {
    for (const match of text.matchAll(NAMED_IMPORT)) {
        const from = match.groups?.from ?? '';
        if (!from.startsWith('.') || !/\.specification\.[jt]s$/u.test(from)) {
            continue;
        }
        const specification = join(dirname(file), from.replace(/\.js$/u, '.ts'));
        if (!existsSync(specification)) {
            continue;
        }
        for (const inner of readFileSync(specification, 'utf8').matchAll(NAMED_IMPORT)) {
            const entry = inner.groups?.from ?? '';
            if (isEntry(entry)) {
                return entry.startsWith('.')
                    ? pathFrom(dirname(file), join(dirname(specification), entry))
                    : entry;
            }
        }
    }
    return '@jterrazz/test';
}

/** Add the wrappers to an import of the entry the file already has — `undefined` when it has none. */
function mergedIntoEntry(text: string, called: Set<string>): string | undefined {
    for (const match of text.matchAll(NAMED_IMPORT)) {
        const from = match.groups?.from ?? '';
        if (!isEntry(from)) {
            continue;
        }
        const present = (match.groups?.names ?? '')
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
        const names = [...new Set([...present, ...called])].toSorted((a, b) =>
            a.toLowerCase() < b.toLowerCase() ? -1 : 1,
        );
        const quote = match.groups?.quote ?? "'";
        return text.replace(
            match[0],
            `import { ${names.join(', ')} } from ${quote}${from}${quote};`,
        );
    }
    return undefined;
}

/** Every import statement, with where it comes from. */
const IMPORT_STATEMENT = /^import[\s\S]*?from\s*(?<quote>['"])(?<from>[^'"]+)\k<quote>;?$/gmu;

/**
 * Insert a new import line: a package import sits with the packages, before the
 * first relative one; a relative entry sits last, with its own kind.
 */
function withImport(text: string, line: string, entry: string): string {
    const imports = [...text.matchAll(IMPORT_STATEMENT)];
    const firstRelative = entry.startsWith('.')
        ? undefined
        : imports.find((match) => (match.groups?.from ?? '').startsWith('.'));
    const at = firstRelative?.index;
    if (at !== undefined) {
        const before = text.slice(0, at);
        if (before.trim().length === 0) {
            return `${before}${line}\n\n${text.slice(at)}`;
        }
        const gap = before.endsWith('\n\n') ? at - 1 : at;
        return `${text.slice(0, gap)}${line}\n${text.slice(gap)}`;
    }
    const last = imports.at(-1);
    if (last?.index === undefined) {
        return `${line}\n${text}`;
    }
    const end = last.index + last[0].length;
    return `${text.slice(0, end)}\n${line}${text.slice(end)}`;
}

/** Make the file import every wrapper it calls. */
function importWrappers(text: string, file: string): string {
    const called = new Set(
        [...text.matchAll(WRAPPER_CALL)].map((match) => match.groups?.name ?? ''),
    );
    if (called.size === 0) {
        return text;
    }
    const merged = mergedIntoEntry(text, called);
    if (merged !== undefined) {
        return merged;
    }
    const entry = entryFor(text, file);
    return withImport(
        text,
        `import { ${[...called].toSorted().join(', ')} } from '${entry}';`,
        entry,
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
 * A tree the mover walks: its 16 folders, the files it rewrites — listed once
 * the folders carry their bare names — and the specs root its pool sits under.
 */
type Walked = { files: () => string[]; folders: string[]; specsRoot: string };

/** Rename the folders, then rewrite the files — on a tree that still holds a 16 folder, and only there. */
function migrate(root: string, { files, folders, specsRoot }: Walked, rename: Rename): Migration {
    if (folders.length === 0) {
        return { renamed: [], rewritten: [] };
    }
    const renamed: string[] = [];
    for (const dir of folders) {
        const bare = RENAMED_GROUND_DIRS[dir.split(sep).at(-1) ?? ''];
        const target = bare === undefined ? undefined : join(dirname(dir), bare);
        if (target !== undefined && !existsSync(target)) {
            rename(dir, target);
            renamed.push(`${relative(root, dir)} → ${relative(root, target)}`);
        }
    }
    const rewritten: string[] = [];
    for (const file of files()) {
        const text = readFileSync(file, 'utf8');
        const isDocument = file.endsWith(SPEC_EXTENSION);
        const moved = isDocument
            ? migrateDocument(text, file, specsRoot)
            : migrateSource(text, file, specsRoot);
        const bare = moved.replaceAll(OLD_SEGMENT, '$<name>');
        const next = isDocument || bare === text ? bare : importWrappers(bare, file);
        if (next !== text) {
            writeFileSync(file, next);
            rewritten.push(relative(root, file));
        }
    }
    return { renamed, rewritten };
}

/** Apply the 16 → 17 migration to a specs tree that still holds a 16 folder. */
export function migrateTo17(root: string, rename: Rename): Migration {
    return migrate(
        root,
        { files: () => specFiles(root), folders: oldGroundFolders(root), specsRoot: root },
        rename,
    );
}

/**
 * Every module test of a member and every 16 ground folder they stand on —
 * outside `specs/` (the tree pass's), never inside ground, never into a
 * nested package.
 */
function moduleTests(member: string): Omit<Walked, 'specsRoot'> {
    const files: string[] = [];
    const folders: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isFile() && isTestFileName(entry.name)) {
                files.push(path);
            } else if (entry.isDirectory() && RENAMED_GROUND_DIRS[entry.name] !== undefined) {
                folders.push(path);
            } else if (
                entry.isDirectory() &&
                !SKIPPED.has(entry.name) &&
                !isGroundName(entry.name) &&
                entry.name !== 'specs' &&
                !existsSync(join(path, 'package.json'))
            ) {
                walk(path);
            }
        }
    };
    walk(member);
    return { files: () => files, folders };
}

/** Apply the 16 → 17 migration to the module tests of a member that still stand on a 16 folder. */
export function migrateModuleTestsTo17(member: string, rename: Rename): Migration {
    return migrate(member, { ...moduleTests(member), specsRoot: join(member, 'specs') }, rename);
}
