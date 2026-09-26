import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { SPEC_EXTENSION } from '../../src/facets/cli/documents/spec-document.js';
import { treeEntries, treeKind } from '../../src/kernel/files/git-tree.js';
import {
    GROUND_FIXTURES,
    isGroundName,
    RENAMED_GROUND_DIRS,
    SHARED_GROUND,
} from '../../src/kernel/files/ground.js';
import { repointModuleTests } from '../checks/crossfile.js';
import { entryFor, mergedIntoEntry, pathFrom, withImport } from '../checks/entry-import.js';
import { isTestFileName } from '../reading/role.js';
import { PASS_NAMES, RULE_NAMES } from './names.js';
import { migrateStubs } from './stubs.js';

/** The 16 → 17 mover behind `--fix`. Its gate is per file: a file is 16-shaped while a 16 folder it stands on is still there, and every other file is left alone. Only literal arguments move, and a `toMatch` literal only when its golden exists. */

export type Migration = {
    directives: string[];
    renamed: string[];
    rewritten: string[];
    stubs: string[];
};

/** Injected so the CLI keeps git's history of what it moves. */
export type Rename = (from: string, to: string) => void;

const SKIPPED = new Set(['.artifacts', '.git', 'coverage', 'dist', 'node_modules']);

type Call = { quote: string; space: string; value: string };

function callOf(match: unknown[]): Call {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every pattern below declares these three groups, and a replacer's last argument IS the groups object
    return match.at(-1) as Call;
}

const LITERAL = '(?<quote>[\'"`])(?<value>[^\'"`\\n]*)\\k<quote>';

/** The walk never enters ground: renaming there would rewrite the input a negative spec exists to keep. */
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

function isDirectoryAt(path: string): boolean {
    return treeKind(path) === 'directory';
}

function isPlain(value: string): boolean {
    return !value.includes('${');
}

function wrapped(next: string, wrap: string, { quote, space }: Call, path: string): string {
    return `.${next}(${space}${wrap}(${quote}${path}${quote})`;
}

const PROTOTYPE_VERBS: Record<string, [verb: string, wrap: string]> = {
    fixtureDirectory: ['fixture', 'directory'],
    fixtureFile: ['fixture', 'file'],
    requestFile: ['request', 'file'],
    seedFile: ['seed', 'file'],
    toMatchDirectory: ['toMatch', 'directory'],
    toMatchFile: ['toMatch', 'file'],
};

/** `body` and `value` are out: on an api or integration result they are json as often as text. */
const STREAM_SUBJECT = String.raw`[\w$.]*?\.(?:content|console|error|errors|html|stderr|stdout|title|tree)(?:\.grep\([^()]*\))*`;

const STREAM_VALUE = new RegExp(
    String.raw`expect\((?<space>\s*)(?<subject>${STREAM_SUBJECT})(?<close>\s*,?\s*\))(?<not>(?:\.not)?)\.(?<matcher>toContain|toMatch)\((?!\s*(?:directory|file)\()`,
    'gu',
);

const STREAM_EMPTY = new RegExp(
    String.raw`(?:await\s+)?expect\((?<space>\s*)(?<subject>${STREAM_SUBJECT})(?<close>\s*,?\s*\))(?<not>(?:\.not)?)\.toBeEmpty\(\)`,
    'gu',
);

function migrateSource(text: string, file: string, root: string): string {
    return migrateVerbs(text, file, root)
        .replaceAll(STREAM_VALUE, 'expect($<space>$<subject>.text$<close>$<not>.$<matcher>(')
        .replaceAll(STREAM_EMPTY, "expect($<space>$<subject>.text$<close>$<not>.toBe('')");
}

const QUOTES = new Set(["'", '"', '`']);

/** oxlint refuses to start on an override of a rule its plugin no longer defines. */
const RETIRED_RULES: readonly string[] = [
    'b2-known-fixture-marker',
    'c13-underscored-ground',
    'c8-referenced-fixture-exists',
    'd12w-response-body-probe',
    'f3-specs-public-entry',
];

const LINT_CONFIGS = [
    '.oxlintrc.json',
    'oxlint.config.js',
    'oxlint.config.mjs',
    'oxlint.config.mts',
    'oxlint.config.ts',
];

export type LintConfigMove = { file: string; removed: string[]; renamed: string[] };

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

function migrateLintConfigText(
    text: string,
    json: boolean,
): Omit<LintConfigMove, 'file'> & { text: string } {
    const removed: string[] = [];
    const renamed: string[] = [];
    let next = text;
    for (const [from, to] of Object.entries(RULE_NAMES)) {
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

const TEXT_BYPASS = /\bjterrazz\/d8w-text-bypass\b/u;

const DIRECTIVE = /(?:oxlint|eslint)-(?:disable|enable)(?<scope>-next-line|-line)?\b/u;

const RAW_READ = /\.text(?=\s*\)(?:\.not)?\.(?:toContain|toMatch)\()/gu;

/** A directive spelled inside a string is text. */
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

const CHECKER_DIRECTIVE =
    /(?<directive>checker-disable(?:-next)?-line\s+)(?<ids>[\w*-]+(?:\s*,\s*[\w*-]+)*)/giu;

function passNamesOf(id: string): readonly string[] {
    const code = id.toLowerCase();
    return (
        PASS_NAMES[code] ?? PASS_NAMES[`${code}w`] ?? PASS_NAMES[code.replace(/w$/u, '')] ?? [id]
    );
}

function renameCheckerDirectives(text: string): string {
    return text.replaceAll(CHECKER_DIRECTIVE, (whole: string, directive: string, ids: string) => {
        const names = [...new Set(ids.split(/\s*,\s*/u).flatMap(passNamesOf))];
        const next = `${directive}${names.join(', ')}`;
        return next === whole ? whole : next;
    });
}

/** A 16 `.text` was the raw capture, so the line a `d8w-text-bypass` directive covers reads `.raw`. */
function renameDirectives(source: string): string {
    const text = renameCheckerDirectives(source);
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
        for (const [from, to] of Object.entries(RULE_NAMES)) {
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

const WRAPPER_CALL = /(?<![.\w])(?<name>directory|file)\(/gu;

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

const OLD_SEGMENT = /(?<=['"/ ])_(?<name>fixtures|expected|requests|seeds)(?=\/)/gu;

type Walked = { files: () => string[]; folders: string[]; specsRoot: string };

const POOL_PREFIX = '$FIXTURES/';

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

/** Which file stood on a 16 folder is read from the folders found before the renames. */
function migrate(root: string, { files, folders, specsRoot }: Walked, rename: Rename): Migration {
    const sixteenDirs = new Set(folders.map((dir) => dirname(dir)));
    const sixteenPool = folders.includes(join(specsRoot, `_${GROUND_FIXTURES}`));
    const migration: Migration = {
        directives: [],
        renamed: renameFolders(root, { folders, specsRoot }, rename),
        rewritten: [],
        stubs: [],
    };
    for (const file of files()) {
        const text = readFileSync(file, 'utf8');
        const isSixteen =
            sixteenDirs.has(dirname(file)) || (sixteenPool && text.includes(POOL_PREFIX));
        const isDocument = file.endsWith(SPEC_EXTENSION);
        const next = isSixteen
            ? movedToSeventeen(text, file, specsRoot)
            : isDocument
              ? renameCheckerDirectives(text)
              : renameDirectives(text);
        if (next !== text) {
            writeFileSync(file, next);
            migration[isSixteen ? 'rewritten' : 'directives'].push(relative(root, file));
        }
    }
    return migration;
}

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
    const stubs = migrateStubs(root, 'specs', rename);
    return {
        ...migration,
        renamed: [...migration.renamed, ...stubs.renamed],
        rewritten: [...migration.rewritten, ...rewritten],
        stubs: stubs.rewritten,
    };
}

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

export function migrateModuleTestsTo17(member: string, rename: Rename): Migration {
    const migration = migrate(
        member,
        { ...moduleTests(member), specsRoot: join(member, 'specs') },
        rename,
    );
    const stubs = migrateStubs(member, 'member', rename);
    return {
        ...migration,
        renamed: [...migration.renamed, ...stubs.renamed],
        stubs: stubs.rewritten,
    };
}
