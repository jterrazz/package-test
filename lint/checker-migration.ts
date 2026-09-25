import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import {
    GROUND_FIXTURES,
    isGroundName,
    RENAMED_GROUND_DIRS,
    SHARED_GROUND,
} from '../src/model/chain/ground.js';
import { SPEC_EXTENSION } from '../src/model/literate/spec-document.js';
import { treeEntries, treeKind } from '../src/seams/git/tree.js';
import { repointModuleTests } from './checker-crossfile.js';
import { isTestFileName } from './role.js';

/**
 * The 16 → 17 mover — what `jterrazz-test-check --fix` does to a tree written
 * for 16.x.
 *
 * Its gate is per FILE: a file is 16.x-shaped when a 16 folder it stands on
 * is still there — an `_fixtures/`, `_expected/`, `_requests/` or `_seeds/`
 * folder beside it, or the 16 pool (`<specs>/_fixtures/`) when the file names
 * it by `$FIXTURES/`. Every other file is on 17 and no 16 gesture touches it,
 * whatever the rest of its tree holds: its bare strings are values, or the
 * deliberate refusals a negative spec exists to keep. Two trees are walked: a
 * `specs/` tree, and the module tests of a member (every test outside
 * `specs/`, never ground, never a nested package).
 *
 * Its gestures, in this order:
 *
 * 1. every 16 ground folder takes its bare name (C13), deepest first — the
 *    16 pool, `<specs>/_fixtures/`, goes to the shared ground,
 *    `<specs>/shared/fixtures/`;
 * 2. in a 16.x-shaped file, every call names the disk with `file()` or `directory()`, by the path from
 *    the spec: `.seed('x.sql')` → `.seed(file('./seeds/x.sql'))`,
 *    `.request('x.http')` → `.request(file('./requests/x.http'))`,
 *    `.fixture('$FIXTURES/app/')` → `.fixture(directory('../../shared/fixtures/app/'))`,
 *    `.fixture('x.toml')` → `.fixture(file('./fixtures/x.toml'))`,
 *    `toMatch('help.txt')` → `toMatch(file('./expected/help.txt'))`, a golden
 *    tree → `toMatch(directory('./expected/<name>/'))`, `.run('x.spec.yaml')` →
 *    `.run(file('./x.spec.yaml'))` — and a document's `fixture:` names its path
 *    the same way;
 * 3. a stream compared as a VALUE reads its text: 16 overrode `toContain` and
 *    `toMatch` on a stream accessor, 17 leaves both to vitest, so
 *    `expect(result.stdout).toContain('x')` → `expect(result.stdout.text).toContain('x')`
 *    (`.not` included, a `.grep(…)` subject too; a `toMatch(file(…))` golden
 *    stays on the accessor), and a stream asserted empty is an empty text:
 *    `await expect(result.stderr).toBeEmpty()` →
 *    `expect(result.stderr.text).toBe('')`, the `await` dropped with the
 *    promise (a table keeps its `toBeEmpty`);
 * 4. a source the second gesture touched imports the two names it now calls;
 * 5. in EVERY file walked, 16.x-shaped or not, a suppression directive — a
 *    comment, never a string literal that spells one — naming a rule 17
 *    renamed names its new id (`d8w-text-bypass` → `d8w-raw-bypass`),
 *    and the one line a `-next-line` or `-line` directive covers reads `.raw`
 *    where 16 read `.text` — the raw capture it always compared. No 17 file
 *    can name the 16 id, and a renamed directive no longer matches, so the
 *    gesture is idempotent. A directive naming a rule 17 retired is left: the
 *    toolchain's Suppressions pass reports it as dead;
 * 6. in a member's oxlint config, an override of a rule 17 renamed names its
 *    new id, and an override of a static rule 17 retired is removed with the
 *    comment lines that stood directly above it — oxlint refuses to start on
 *    a rule the plugin does not define.
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

/**
 * What the mover did, relative to the tree it walked: the folders renamed, the
 * 16.x-shaped files rewritten, and the other files whose directives alone
 * were renamed.
 */
export type Migration = { directives: string[]; renamed: string[]; rewritten: string[] };

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
        for (const entry of treeEntries(dir)) {
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
        for (const entry of treeEntries(dir)) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                const isPool = depth === 0 && entry.name === SHARED_GROUND;
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
        return `${pathFrom(specDir, join(root, SHARED_GROUND, GROUND_FIXTURES))}/${value.slice('$FIXTURES/'.length)}`;
    }
    if (value.startsWith('$')) {
        return undefined;
    }
    return `./${GROUND_FIXTURES}/${value}`;
}

/** Is `path` a directory of the tree? */
function isDirectoryAt(path: string): boolean {
    return treeKind(path) === 'directory';
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
const STREAM_SUBJECT = String.raw`[\w$.]*?\.(?:content|console|error|errors|html|stderr|stdout|title|tree)(?:\.grep\([^()]*\))*`;

/** A stream compared as a value: `expect(<stream>)[.not].toContain|toMatch(<value>)`. */
const STREAM_VALUE = new RegExp(
    String.raw`expect\((?<space>\s*)(?<subject>${STREAM_SUBJECT})(?<close>\s*,?\s*\))(?<not>(?:\.not)?)\.(?<matcher>toContain|toMatch)\((?!\s*(?:directory|file)\()`,
    'gu',
);

/** A stream asserted empty: `[await ]expect(<stream>)[.not].toBeEmpty()` — a table's matcher alone in 17. */
const STREAM_EMPTY = new RegExp(
    String.raw`(?:await\s+)?expect\((?<space>\s*)(?<subject>${STREAM_SUBJECT})(?<close>\s*,?\s*\))(?<not>(?:\.not)?)\.toBeEmpty\(\)`,
    'gu',
);

/** Rewrite the 16 (and prototype) calls of one source file; `root` is the specs tree. */
function migrateSource(text: string, file: string, root: string): string {
    return migrateVerbs(text, file, root)
        .replaceAll(STREAM_VALUE, 'expect($<space>$<subject>.text$<close>$<not>.$<matcher>(')
        .replaceAll(STREAM_EMPTY, "expect($<space>$<subject>.text$<close>$<not>.toBe('')");
}

/** The rules 17 renamed: the 16 id → the id a directive names now. */
const RENAMED_RULES: Readonly<Record<string, string>> = {
    'c2-http-only-requests': 'c2-request-extension',
    'd8w-text-bypass': 'd8w-raw-bypass',
};

/** A string literal's opening quote. */
const QUOTES = new Set(["'", '"', '`']);

/**
 * The static rules 16 published and 17's published plugin no longer defines
 * — an override of one in an oxlint config stops oxlint from starting. F3 is
 * one: its subpath half is F1's, and the rest holds this package alone.
 * A rule 17 renamed is in {@link RENAMED_RULES} instead.
 */
const RETIRED_RULES: readonly string[] = [
    'b2-known-fixture-marker',
    'c13-underscored-ground',
    'c8-referenced-fixture-exists',
    'd12w-response-body-probe',
    'f3-specs-public-entry',
];

/** The files oxlint reads its config from, at a member's root. */
const LINT_CONFIGS = [
    '.oxlintrc.json',
    'oxlint.config.js',
    'oxlint.config.mjs',
    'oxlint.config.mts',
    'oxlint.config.ts',
];

/** What the mover did to one oxlint config: the overrides it removed and renamed, by rule id. */
export type LintConfigMove = { file: string; removed: string[]; renamed: string[] };

/** Past the string or comment that opens at `index` — or `index` itself when none does. */
function pastSkipped(text: string, index: number): number {
    const char = text[index] ?? '';
    if (QUOTES.has(char)) {
        let at = index + 1;
        while (at < text.length && text[at] !== char) {
            at += text[at] === '\\' ? 2 : 1;
        }
        return at + 1;
    }
    if (text.startsWith('//', index)) {
        const next = text.indexOf('\n', index);
        return next === -1 ? text.length : next;
    }
    if (text.startsWith('/*', index)) {
        const close = text.indexOf('*/', index);
        return close === -1 ? text.length : close + 2;
    }
    return index;
}

/** Where the property value opening at `start` ends: the `,` or the closing bracket at its own depth. */
function valueEnd(text: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < text.length) {
        const past = pastSkipped(text, index);
        if (past !== index) {
            index = past;
            continue;
        }
        const char = text[index] ?? '';
        const closes = ')]}'.includes(char);
        if ((closes || char === ',') && depth === 0) {
            return index;
        }
        depth += '([{'.includes(char) ? 1 : closes ? -1 : 0;
        index += 1;
    }
    return text.length;
}

/** The start of the comment-only lines directly above the line that starts at `lineStart`. */
function commentsAbove(text: string, lineStart: number): number {
    let start = lineStart;
    while (start > 0) {
        const previous = text.lastIndexOf('\n', start - 2) + 1;
        if (!/^\s*\/\//u.test(text.slice(previous, start - 1))) {
            break;
        }
        start = previous;
    }
    return start;
}

/**
 * The config without the first property keyed `jterrazz/<id>` — its whole
 * lines and the comments directly above it when it stands on lines of its
 * own — or `undefined` when no property is keyed so.
 */
function withoutOverride(text: string, id: string, json: boolean): string | undefined {
    const key = new RegExp(`(['"])jterrazz/${id}\\1\\s*:`, 'u').exec(text);
    if (key === null) {
        return undefined;
    }
    const valueStop = valueEnd(text, key.index + key[0].length);
    const comma = text[valueStop] === ',';
    let end = comma
        ? valueStop + 1
        : key.index +
          key[0].length +
          text.slice(key.index + key[0].length, valueStop).trimEnd().length;
    const lineStart = text.lastIndexOf('\n', key.index - 1) + 1;
    const ownLine = /^\s*$/u.test(text.slice(lineStart, key.index));
    const lineEnd = text.indexOf('\n', end);
    const restBlank = /^\s*$/u.test(text.slice(end, lineEnd === -1 ? text.length : lineEnd));
    const start = ownLine ? commentsAbove(text, lineStart) : key.index;
    if (ownLine && restBlank) {
        end = lineEnd === -1 ? text.length : lineEnd + 1;
    }
    const before = text.slice(0, start).trimEnd();
    if (json && !comma && before.endsWith(',')) {
        // JSON takes no trailing comma: the last property removed takes the one before it.
        const at = before.length - 1;
        return text.slice(0, at) + text.slice(at + 1, start) + text.slice(end);
    }
    return text.slice(0, start) + text.slice(end);
}

/** Move one oxlint config to 17: renamed rules take their new id, retired ones leave. */
function migrateLintConfigText(
    text: string,
    json: boolean,
): Omit<LintConfigMove, 'file'> & { text: string } {
    const removed: string[] = [];
    const renamed: string[] = [];
    let next = text;
    for (const [from, to] of Object.entries(RENAMED_RULES)) {
        const replaced = next.replaceAll(
            new RegExp(`(['"])jterrazz/${from}\\1`, 'gu'),
            `$1jterrazz/${to}$1`,
        );
        if (replaced !== next) {
            renamed.push(from);
            next = replaced;
        }
    }
    for (const id of RETIRED_RULES) {
        let without = withoutOverride(next, id, json);
        if (without !== undefined) {
            removed.push(id);
        }
        while (without !== undefined) {
            next = without;
            without = withoutOverride(next, id, json);
        }
    }
    return { removed, renamed, text: next };
}

/**
 * Move the oxlint configs at a member's root to 17 — the overrides of a
 * renamed rule renamed, of a retired one removed — and say what moved, each
 * file relative to `root`.
 */
export function migrateLintConfig(member: string, root: string): LintConfigMove[] {
    const moves: LintConfigMove[] = [];
    for (const name of LINT_CONFIGS) {
        const path = join(member, name);
        if (treeKind(path) !== 'file') {
            continue;
        }
        const text = readFileSync(path, 'utf8');
        const moved = migrateLintConfigText(text, name.endsWith('.json'));
        if (moved.text !== text) {
            writeFileSync(path, moved.text);
            moves.push({
                file: relative(root, path),
                removed: moved.removed,
                renamed: moved.renamed,
            });
        }
    }
    return moves;
}

/** The 16 id whose covered line reads `.raw` once its directive is renamed. */
const TEXT_BYPASS = /\bjterrazz\/d8w-text-bypass\b/u;

/** A suppression directive, and whether it covers its own line or the next. */
const DIRECTIVE = /(?:oxlint|eslint)-(?:disable|enable)(?<scope>-next-line|-line)?\b/u;

/** The raw read a 16 `.text` was, in a value comparison: `expect(<x>.text).toContain(`. */
const RAW_READ = /\.text(?=\s*\)(?:\.not)?\.(?:toContain|toMatch)\()/gu;

/**
 * Where the comment of a line starts — a `//` or `/*` outside every string
 * literal the line opens — or -1. A directive spelled inside a string is text.
 */
function commentStart(line: string): number {
    let quote: string | undefined;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index] ?? '';
        if (quote === undefined && QUOTES.has(char)) {
            quote = char;
        } else if (quote !== undefined) {
            index += char === '\\' ? 1 : 0;
            quote = char === quote ? undefined : quote;
        } else if (char === '/' && ['/', '*'].includes(line[index + 1] ?? '')) {
            return index;
        }
    }
    return -1;
}

/**
 * A directive naming a renamed rule names its new id. A 16 `.text` WAS the raw
 * capture, so the line a `d8w-text-bypass` directive covers reads `.raw` —
 * the same bytes it compared, and the accessor `d8w-raw-bypass` warns about.
 */
function renameDirectives(text: string): string {
    const lines = text.split('\n');
    for (const [index, line] of lines.entries()) {
        const start = commentStart(line);
        const comment = start === -1 ? '' : line.slice(start);
        const directive = DIRECTIVE.exec(comment);
        if (directive === null) {
            continue;
        }
        const scope = directive.groups?.scope;
        let renamed = comment;
        for (const [from, to] of Object.entries(RENAMED_RULES)) {
            renamed = renamed.replaceAll(
                new RegExp(`\\bjterrazz/${from}\\b`, 'gu'),
                `jterrazz/${to}`,
            );
        }
        if (renamed === comment) {
            continue;
        }
        const covered = scope === '-next-line' ? index + 1 : index;
        lines[index] = `${line.slice(0, start)}${renamed}`;
        if (scope !== undefined && TEXT_BYPASS.test(comment)) {
            lines[covered] = (lines[covered] ?? '').replaceAll(RAW_READ, '.raw');
        }
    }
    return lines.join('\n');
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
                if (name.length === 0 || !isPlain(value) || treeKind(golden) === undefined) {
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
        if (treeKind(specification) !== 'file') {
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

/** Make the file import `name` from the framework's entry — the one it has, or the one its specification uses. */
export function withEntryImport(text: string, file: string, name: string): string {
    const merged = mergedIntoEntry(text, new Set([name]));
    if (merged !== undefined) {
        return merged;
    }
    const entry = entryFor(text, file);
    return withImport(text, `import { ${name} } from '${entry}';`, entry);
}

/** Does the file import `name` from the framework's entry? */
export function importsFromEntry(text: string, name: string): boolean {
    return [...text.matchAll(NAMED_IMPORT)].some(
        (match) =>
            isEntry(match.groups?.from ?? '') &&
            (match.groups?.names ?? '').split(',').some((each) => each.trim() === name),
    );
}

/** Drop `name` from the file's import of the framework's entry, the whole import when it was the last name. */
export function withoutEntryImport(text: string, name: string): string {
    for (const match of text.matchAll(NAMED_IMPORT)) {
        const from = match.groups?.from ?? '';
        if (!isEntry(from)) {
            continue;
        }
        const names = (match.groups?.names ?? '')
            .split(',')
            .map((each) => each.trim())
            .filter((each) => each.length > 0);
        if (!names.includes(name)) {
            continue;
        }
        const kept = names.filter((each) => each !== name);
        const quote = match.groups?.quote ?? "'";
        return kept.length === 0
            ? text.replace(`${match[0]}\n`, '')
            : text.replace(match[0], `import { ${kept.join(', ')} } from ${quote}${from}${quote};`);
    }
    return text;
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

/** The 16 pool prefix — a file spelling it stands on the pool. */
const POOL_PREFIX = '$FIXTURES/';

/** The text a 16.x-shaped file takes: every gesture, directives included. */
function movedToSeventeen(text: string, file: string, specsRoot: string): string {
    if (file.endsWith(SPEC_EXTENSION)) {
        return migrateDocument(text, file, specsRoot).replaceAll(OLD_SEGMENT, '$<name>');
    }
    const bare = migrateSource(renameDirectives(text), file, specsRoot).replaceAll(
        OLD_SEGMENT,
        '$<name>',
    );
    return bare === text ? bare : importWrappers(bare, file);
}

/**
 * Rename every 16 folder to its bare name, deepest first — one at the specs
 * root to the shared ground's folder of its role; what moved, relative to `root`.
 */
function renameFolders(
    root: string,
    { folders, specsRoot }: Pick<Walked, 'folders' | 'specsRoot'>,
    rename: Rename,
): string[] {
    const renamed: string[] = [];
    for (const dir of folders) {
        const bare = RENAMED_GROUND_DIRS[dir.split(sep).at(-1) ?? ''];
        const parent = dirname(dir) === specsRoot ? join(specsRoot, SHARED_GROUND) : dirname(dir);
        const target = bare === undefined ? undefined : join(parent, bare);
        if (target !== undefined && !existsSync(target)) {
            mkdirSync(parent, { recursive: true });
            rename(dir, target);
            renamed.push(`${relative(root, dir)} → ${relative(root, target)}`);
        }
    }
    return renamed;
}

/**
 * Rename the 16 folders, rewrite the files that stood on one, and rename the
 * directives of every other file.
 *
 * Which file stood on a 16 folder is read from the folders found BEFORE the
 * renames: a directory that held one, and the pool when it was `_fixtures/`.
 */
function migrate(root: string, { files, folders, specsRoot }: Walked, rename: Rename): Migration {
    const sixteenDirs = new Set(folders.map((dir) => dirname(dir)));
    const sixteenPool = folders.includes(join(specsRoot, `_${GROUND_FIXTURES}`));
    const migration: Migration = {
        directives: [],
        renamed: renameFolders(root, { folders, specsRoot }, rename),
        rewritten: [],
    };
    for (const file of files()) {
        const text = readFileSync(file, 'utf8');
        const isSixteen =
            sixteenDirs.has(dirname(file)) || (sixteenPool && text.includes(POOL_PREFIX));
        const isDocument = file.endsWith(SPEC_EXTENSION);
        const next = isSixteen
            ? movedToSeventeen(text, file, specsRoot)
            : isDocument
              ? text
              : renameDirectives(text);
        if (next !== text) {
            writeFileSync(file, next);
            migration[isSixteen ? 'rewritten' : 'directives'].push(relative(root, file));
        }
    }
    return migration;
}

/**
 * Apply the 16 → 17 migration to a specs tree: its 16.x-shaped files, every
 * file's directives, and the paths the member's module tests name into a
 * renamed folder.
 */
export function migrateTo17(root: string, rename: Rename): Migration {
    const moves: { copy: string; target: string }[] = [];
    const migration = migrate(
        root,
        { files: () => specFiles(root), folders: oldGroundFolders(root), specsRoot: root },
        (from, to) => {
            rename(from, to);
            moves.push({ copy: from, target: to });
        },
    );
    const rewritten = repointModuleTests(root, moves).map((file) => relative(root, file));
    return { ...migration, rewritten: [...migration.rewritten, ...rewritten] };
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
        for (const entry of treeEntries(dir)) {
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
                treeKind(join(path, 'package.json')) !== 'file'
            ) {
                walk(path);
            }
        }
    };
    walk(member);
    return { files: () => files, folders };
}

/** Apply the 16 → 17 migration to the module tests of a member, gated per file like a specs tree. */
export function migrateModuleTestsTo17(member: string, rename: Rename): Migration {
    return migrate(member, { ...moduleTests(member), specsRoot: join(member, 'specs') }, rename);
}
