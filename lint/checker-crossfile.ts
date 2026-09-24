import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { GROUND_DIRS, isGroundName, SHARED_GROUND } from '../src/model/chain/ground.js';
import { isRelativePath } from '../src/model/chain/spec-path.js';
import {
    documentPaths,
    parseSpecDocument,
    SPEC_EXTENSION,
} from '../src/model/literate/spec-document.js';
import { moveKeepingHistory, treeEntries, treeKind } from '../src/seams/git/tree.js';
import { specsAnchor } from './ast.js';
import type { Severity, TokenViolation } from './checker.js';
import type { Teaching } from './lesson.js';
import { moduleTestsOf } from './module-tests.js';
import { isNodeTestFileName, isTestFileName } from './role.js';
import { literalSpans } from './spec-values.js';

/**
 * The cross-file checker passes — the analyses oxlint cannot express because
 * they need to read TWO files at once (a `*.specification.ts` record and the
 * `specs/` test files importing it) or a whole feature tree at once.
 *
 * They live in the checker channel (bundled as `dist/checker.js`) rather than
 * the oxlint plugin, which only ever sees one source file. Each pass follows
 * the checker doctrine: **precision over recall** — a heuristic that cannot
 * decide stays silent (under-reports) so the pass never blocks a legitimate
 * shape. All three are string/scan based (no TS parser in the light lint
 * bundle), matching the token checker's aesthetic.
 *
 * - **C9 dead fixtures** — per feature dir, a fixture file no reference
 *   RESOLVES to is dead weight; a feature dir with ground subdirs but no
 *   `<feature>.test.ts` is an orphan. A `<case>.spec.yaml` counts as a test
 *   AND as a referrer: the paths of its `fixture:` entries keep those trees
 *   alive exactly as a `.fixture(directory('…'))` literal does.
 * - **B5 await-using (inference)** — the docker-aware runners of a spec file
 *   are derived from its `docker:` option, then every `<runner>….exec()` bound
 *   without `await using` in an importing test is flagged. The primary B5
 *   channel now (the oxlint rule needs the runner names spelled out by hand).
 * - **A7 database property** — a spec's `services:` record fixes how many SQL
 *   databases exist; importing tests must (≥2) or must not (==1) pass
 *   `{ database }` to every `.seed()` / `.table()`.
 * - **C28 / C15 where ground lives** — an entry of the specs root's shared
 *   ground (`<specs>/shared/<role>/`) only ONE spec directory reaches for
 *   belongs beside that leaf (autofixed), and a path leaves its leaf only
 *   into that ground.
 */

/** Directories the cross-file walks never descend into. */
const PRUNED = new Set(['.git', 'dist', 'node_modules']);

/** The ground directories of a leaf — the files a spec stands on. */
const GROUND_SUBDIRS = new Set<string>(GROUND_DIRS);

/** Destructured names that are never a runner (so never the A7/B5 subject). */
const NON_RUNNER_BINDINGS = new Set(['cleanup', 'docker', 'orchestrator']);

/** The specification constructors whose records/options the passes read. */
const CONSTRUCTORS = 'api|cli|jobs';

/** Is this the shared folder of a specs root — `<specs>/shared/`? */
function isSharedFolder(dir: string): boolean {
    return basename(dir) === SHARED_GROUND && basename(dirname(dir)) === 'specs';
}

/**
 * A pool is a role folder of the specs root's shared ground —
 * `specs/shared/fixtures/`, `specs/shared/seeds/`, `specs/shared/requests/`,
 * `specs/shared/expected/`, holding what several leaves share. The cross-file
 * walks prune it with the shared folder; {@link checkPoolFixtures} inspects
 * its top level separately.
 */
function isPool(dir: string): boolean {
    return isGroundName(basename(dir)) && isSharedFolder(dirname(dir));
}

/** The four pools a specs root may hold, whether or not they exist. */
export function poolsOf(specsRoot: string): string[] {
    return GROUND_DIRS.map((ground) => join(specsRoot, SHARED_GROUND, ground));
}

/** The specs root a pool belongs to. */
function specsRootOfPool(pool: string): string {
    return dirname(dirname(pool));
}

/**
 * Is this a directory the walks do not enter? Ground — the shared folder and
 * every leaf's own — holds material a spec stands on, never a live spec: a
 * fixture project with a `specs/` tree of its own is an input, judged where a
 * spec runs the checker over it.
 */
function isPruned(dir: string): boolean {
    return PRUNED.has(basename(dir)) || isGroundName(basename(dir)) || isSharedFolder(dir);
}

/** Recursively list every file under `dir`, skipping pruned dirs and the pool. */
export function listFiles(dir: string, predicate: (path: string) => boolean): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) {
                if (!isPruned(path)) {
                    visit(path);
                }
            } else if (predicate(path)) {
                out.push(path);
            }
        }
    };
    visit(dir);
    return out;
}

/** Recursively list every directory under `dir` (inclusive), pool pruned. */
function listDirs(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        out.push(current);
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory() && !isPruned(path)) {
                visit(path);
            }
        }
    };
    visit(dir);
    return out;
}

/**
 * Locate every `specs/` root under `dir` — the anchor a fixture path is
 * measured from. A nested one (a fixture project's own tree) sits inside a pool,
 * which the walk does not enter; the pool's contents are inputs, not live specs.
 */
export function findSpecsRoots(dir: string): string[] {
    const roots: string[] = [];
    const visit = (current: string): void => {
        if (basename(current) === 'specs') {
            roots.push(current);
            return;
        }
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory() && !PRUNED.has(entry.name)) {
                visit(join(current, entry.name));
            }
        }
    };
    visit(dir);
    return roots;
}

/** Locate the pools (unlike {@link listDirs}, does not prune them). */
function findPools(dir: string): string[] {
    const pools: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || PRUNED.has(entry.name)) {
                continue;
            }
            const path = join(current, entry.name);
            if (isPool(path)) {
                pools.push(path);
            } else if (!isGroundName(entry.name)) {
                visit(path);
            }
        }
    };
    visit(dir);
    return pools;
}

function readText(path: string): string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return '';
    }
}

/**
 * Blank out `//` and block comments (replacing them with spaces, newlines
 * preserved so offsets and line numbers stay intact) while leaving string
 * literals untouched. The regex/scan passes read this so a commented-out
 * `.exec()` or a comma inside a `services:` comment never confuses them.
 */
export function blankComments(text: string): string {
    const out = [...text];
    let state: "'" | '"' | '' | '`' | 'block' | 'line' = '';
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (state === 'line') {
            if (char === '\n') {
                state = '';
            } else {
                out[i] = ' ';
            }
        } else if (state === 'block') {
            if (char === '*' && next === '/') {
                out[i] = ' ';
                out[i + 1] = ' ';
                i += 1;
                state = '';
            } else if (char !== '\n') {
                out[i] = ' ';
            }
        } else if (state === '"' || state === "'" || state === '`') {
            if (char === '\\') {
                i += 1;
            } else if (char === state) {
                state = '';
            }
        } else if (char === '/' && next === '/') {
            out[i] = ' ';
            state = 'line';
        } else if (char === '/' && next === '*') {
            out[i] = ' ';
            state = 'block';
        } else if (char === '"' || char === "'" || char === '`') {
            state = char;
        }
    }
    return out.join('');
}

/** File contents with comments blanked — the parse view for the scan passes. */
function readSource(path: string): string {
    return blankComments(readText(path));
}

/**
 * The paths a `<case>.spec.yaml` names — its referrer literals, every key's: a
 * `fixture:`, a `seed:`, a `request:`, a `body:`, a `response:`, an
 * `intercept:`. The runner's own parser reads them, so the two channels cannot
 * disagree about what the document says; an unparseable file vouches for
 * nothing (the `d4b-spec-shape` pass is what reports it).
 */
function collectSpecLiterals(path: string): Set<string> {
    try {
        const document = parseSpecDocument(readText(path), path);
        return new Set(documentPaths(document).map((named) => named.path));
    } catch {
        return new Set();
    }
}

/**
 * Is this a file a leaf's ground may be referenced from?
 *
 * Every test suffix counts, and so does a document: a rendered unit's golden —
 * its ARIA tree — sits in the same `expected/` as a spec's, read by a file the
 * suffix alone tells apart.
 */
function isReferrer(name: string): boolean {
    return isTestFileName(name) || name.endsWith(SPEC_EXTENSION);
}

function isDir(path: string): boolean {
    return treeKind(path) === 'directory';
}

/** The 1-based line number of a source offset. */
/** The 1-based column of `index` on its line. */
function columnAt(text: string, index: number): number {
    return index - text.lastIndexOf('\n', index - 1);
}

function lineAt(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i += 1) {
        if (text[i] === '\n') {
            line += 1;
        }
    }
    return line;
}

/**
 * Every quoted string and simple template literal in a source. Over-collection
 * only ever *hides* a dead-fixture finding, so a greedy regex is safe here.
 */
const STRING_LITERAL =
    /'(?<single>(?:[^'\\\n]|\\.)*)'|"(?<double>(?:[^"\\\n]|\\.)*)"|`(?<template>(?:[^`$\\]|\\.)*)`/gu;
function collectLiterals(text: string): Set<string> {
    const found = new Set<string>();
    for (const match of text.matchAll(STRING_LITERAL)) {
        const value = match.groups?.single ?? match.groups?.double ?? match.groups?.template;
        if (value !== undefined && value.length > 0) {
            found.add(value);
        }
    }
    return found;
}

/**
 * A golden NAMED by a template literal with a hole — the table form chapter 17
 * prescribes for the golden half (`toMatch(file(`./expected/${name}.json`))` under a
 * `test.each`). The hole's value is not readable here, but its static ends are:
 * an entry of `directory` — the folders written before the hole, resolved from
 * the file — whose name starts with `prefix` and ends with `suffix` is one the
 * table could have asked for, which is all C9 needs to stop calling it dead.
 */
export type LiteralPattern = { directory: string; prefix: string; suffix: string };

const TEMPLATE_WITH_HOLE = /`(?<body>(?:[^`\\]|\\.)*\$\{(?:[^`\\]|\\.)*)`/gu;
function collectLiteralPatterns(text: string, from: string): LiteralPattern[] {
    const found: LiteralPattern[] = [];
    for (const match of text.matchAll(TEMPLATE_WITH_HOLE)) {
        const body = match.groups?.body ?? '';
        const opens = body.indexOf('${');
        const closes = body.lastIndexOf('}');
        if (opens === -1 || closes === -1 || closes < opens) {
            continue;
        }
        // The path's folders are the ground this entry sits in; the entry is
        // Matched on what the template states after the last of them, up to
        // The folder the hole may name.
        const before = body.slice(0, opens);
        const cut = before.lastIndexOf('/');
        const prefix = before.slice(cut + 1);
        const suffix = body.slice(closes + 1);
        // A template that is ALL hole names everything; it vouches for
        // Nothing in particular, and C9 already downgrades that file's
        // Findings to warn through `hasNonLiteralFixtureArg`.
        if (prefix.length > 0 || suffix.length > 0) {
            const folders = before.slice(0, Math.max(cut, 0));
            found.push({
                directory: resolve(from, folders),
                prefix,
                suffix: suffix.split('/')[0] ?? '',
            });
        }
    }
    return found;
}

/**
 * Does the text name the disk with a NON-literal — a `file(…)`/`directory(…)`
 * whose path is computed, or a verb that reads the disk (`.seed`, `.request`,
 * `.fixture`, `.run`) handed a variable rather than the wrapper? Either makes
 * the reference set incomplete, so the feature is reported at warn level
 * instead of error (a false positive would be worse than a miss).
 */
const DISK_ARG = /(?<![.\w])(?:file|directory)\s*\(\s*(?<arg>[^,)]*)/gu;
const DISK_VERB_ARG = /\.(?:seed|request|fixture|run)\s*\(\s*(?<arg>[^,)]*)/gu;

/** A plain string literal: quoted, or a template with no hole. */
const PLAIN_STRING = /^(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`$\\]|\\.)*`)$/u;

/** The trimmed first arguments `pattern` captures in `text`, the empty ones dropped. */
function argumentsOf(text: string, pattern: RegExp): string[] {
    return [...text.matchAll(pattern)]
        .map((match) => (match.groups?.arg ?? '').trim())
        .filter((arg) => arg.length > 0);
}

function hasNonLiteralFixtureArg(text: string): boolean {
    const verbTakesABinding = argumentsOf(text, DISK_VERB_ARG).some(
        (arg) => !/^(?:file|directory)\s*\(/u.test(arg),
    );
    return verbTakesABinding || argumentsOf(text, DISK_ARG).some((arg) => !PLAIN_STRING.test(arg));
}

// ── Suppression (checker channel) ────────────────────────────────────────────

/**
 * `// checker-disable-next-line <id>[,<id>] -- reason` suppresses the passes
 * named by id (`a7`, `b5`, `c9`, or `*`) on the next line of code — blank
 * lines and other comments (another tool's directive) are stepped over;
 * `checker-disable-line` suppresses its own line. Mirrors the oxlint-disable
 * idiom the repo already uses for negative specs.
 */
export function suppressedLines(text: string, id: string): Set<number> {
    const suppressed = new Set<number>();
    const lines = text.split('\n');
    const applies = (raw: string): boolean => {
        const ids = raw
            .replace(/--.*$/u, '')
            .trim()
            .split(/[\s,]+/u);
        return ids.includes(id) || ids.includes('*');
    };
    for (const [index, line] of lines.entries()) {
        // Case-insensitive: the repo's formatter capitalizes comment leads
        // (`checker-…` → `Checker-…`).
        let match = /checker-disable-next-line\s+(?<ids>.*)$/iu.exec(line);
        if (match !== null && applies(match.groups?.ids ?? '')) {
            // The next line of CODE: a directive of another tool may stand
            // Between, since each of them also claims the next line.
            for (let next = index + 1; next < lines.length; next += 1) {
                const following = (lines[next] ?? '').trim();
                if (following.length > 0 && !following.startsWith('//')) {
                    suppressed.add(next + 1);
                    break;
                }
            }
        }
        match = /checker-disable-line\s+(?<ids>.*)$/iu.exec(line);
        if (match !== null && applies(match.groups?.ids ?? '')) {
            suppressed.add(index + 1);
        }
    }
    return suppressed;
}

// ── Balanced scanning helpers ────────────────────────────────────────────────

/** From the `(` at `openIndex`, the substring inside the matching `)`. */
function balancedParens(text: string, openIndex: number): string {
    let depth = 0;
    for (let i = openIndex; i < text.length; i += 1) {
        const char = text[i];
        if (char === '(') {
            depth += 1;
        } else if (char === ')') {
            depth -= 1;
            if (depth === 0) {
                return text.slice(openIndex + 1, i);
            }
        }
    }
    return text.slice(openIndex + 1);
}

/** From the `{` at `openIndex`, the substring inside the matching `}`. */
function balancedBraces(text: string, openIndex: number): null | string {
    let depth = 0;
    for (let i = openIndex; i < text.length; i += 1) {
        const char = text[i];
        if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return text.slice(openIndex + 1, i);
            }
        }
    }
    return null;
}

/** Split an object/argument body on its depth-0 commas. */
function splitTopLevel(body: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i += 1) {
        const char = body[i];
        if (char === '{' || char === '(' || char === '[') {
            depth += 1;
        } else if (char === '}' || char === ')' || char === ']') {
            depth -= 1;
        } else if (char === ',' && depth === 0) {
            parts.push(body.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(body.slice(start));
    return parts;
}

// ── Specification-file model ─────────────────────────────────────────────────

type SpecModel = {
    /** True when a `specification.cli(…)` call carries a `docker:` option. */
    dockerAware: boolean;
    file: string;
    /** Named exports bound to a runner (destructured, minus cleanup/docker/…). */
    runnerExports: Set<string>;
    /**
     * Count of SQL database factories in the `services` record, or `null` when
     * the record is absent or not a plain literal (then A7 cannot be decided).
     */
    sqlDatabaseCount: null | number;
};

/** The destructured export names of a `= await specification.<ctor>(` binding. */
function runnerExportsOf(text: string): Set<string> {
    const names = new Set<string>();
    const decl = new RegExp(
        String.raw`\{(?<names>[^}]*)\}\s*=\s*await\s+specification\.(?:${CONSTRUCTORS})\s*\(`,
        'gu',
    );
    for (const match of text.matchAll(decl)) {
        for (const raw of (match.groups?.names ?? '').split(',')) {
            // `export const { cleanup, cli }` / `{ api: bareApi }` → key side.
            const key = (raw.split(':')[0] ?? '').trim();
            if (key.length > 0 && !NON_RUNNER_BINDINGS.has(key)) {
                names.add(key);
            }
        }
    }
    return names;
}

/** The leading callee identifier of an expression (`postgres()` → `postgres`). */
function leadingCallee(value: string): null | string {
    const match = /^(?<callee>[A-Za-z_$][\w$]*)\s*\(/u.exec(value.trim());
    return match === null ? match : (match.groups?.callee ?? null);
}

/** SQL factory count of a `services:` record, or null if non-literal/absent. */
function sqlDatabaseCount(text: string): null | number {
    const keyword = /\bservices\s*:/u.exec(text);
    if (keyword === null) {
        return null;
    }
    const braceIndex = text.indexOf('{', keyword.index + keyword[0].length);
    // A non-`{` value (a variable) is out of static reach.
    if (
        braceIndex === -1 ||
        text.slice(keyword.index + keyword[0].length, braceIndex).trim() !== ''
    ) {
        return null;
    }
    const body = balancedBraces(text, braceIndex);
    if (body === null) {
        return null;
    }
    let count = 0;
    for (const pair of splitTopLevel(body)) {
        if (pair.trim().length === 0) {
            continue;
        }
        const colon = pair.indexOf(':');
        if (colon === -1) {
            return null; // Shorthand / spread — non-literal record.
        }
        const value = pair.slice(colon + 1).trim();
        const callee = leadingCallee(value);
        if (callee === null) {
            return null; // A handle variable — the count is not literal.
        }
        if (callee === 'postgres' || callee === 'sqlite' || callee === 'mysql') {
            count += 1;
        }
    }
    return count;
}

function modelSpecFile(file: string): SpecModel {
    const text = readSource(file);
    let dockerAware = false;
    const cliCall = /specification\.cli\s*\(/gu;
    for (const match of text.matchAll(cliCall)) {
        const argsOpen = text.indexOf('(', match.index);
        if (argsOpen !== -1 && /\bdocker\s*:/u.test(balancedParens(text, argsOpen))) {
            dockerAware = true;
        }
    }
    return {
        dockerAware,
        file,
        runnerExports: runnerExportsOf(text),
        sqlDatabaseCount: sqlDatabaseCount(text),
    };
}

/** Resolve a relative import specifier to a `.ts` path (else undefined). */
function resolveRelativeImport(fromFile: string, specifier: string): string | undefined {
    if (!specifier.startsWith('.')) {
        return undefined;
    }
    return resolve(dirname(fromFile), specifier).replace(/\.js$/u, '.ts');
}

type ImportedBinding = { local: string; name: string; source: string };

/** Every `import { a, b as c } from '…'` binding in a file. */
function namedImports(text: string): ImportedBinding[] {
    const bindings: ImportedBinding[] = [];
    const decl = /import\s+(?:type\s+)?\{(?<names>[^}]*)\}\s+from\s+['"](?<source>[^'"]+)['"]/gu;
    for (const match of text.matchAll(decl)) {
        const source = match.groups?.source ?? '';
        for (const raw of (match.groups?.names ?? '').split(',')) {
            const part = raw.trim();
            if (part.length === 0) {
                continue;
            }
            const [name, local] = part.split(/\s+as\s+/u).map((token) => token.trim());
            if (name === undefined) {
                continue;
            }
            bindings.push({ local: local ?? name, name, source });
        }
    }
    return bindings;
}

// ── B5 (inference) ───────────────────────────────────────────────────────────

/**
 * Docker-aware runner results must be bound with `await using`. The runner
 * identifiers are inferred from the `docker:` option of imported spec files —
 * no hand-maintained runner list, unlike the oxlint rule.
 */
export function checkDockerRunnerAwaitUsing(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const specFiles = listFiles(rootDir, (path) => path.endsWith('.specification.ts'));
    const dockerSpecs = new Map<string, SpecModel>();
    for (const file of specFiles) {
        const model = modelSpecFile(file);
        if (model.dockerAware && model.runnerExports.size > 0) {
            dockerSpecs.set(file, model);
        }
    }
    if (dockerSpecs.size === 0) {
        return violations;
    }

    for (const testFile of listFiles(rootDir, isNodeTestFileName)) {
        const text = readSource(testFile);
        const runners = new Set<string>();
        for (const binding of namedImports(text)) {
            const target = resolveRelativeImport(testFile, binding.source);
            const model = target === undefined ? undefined : dockerSpecs.get(target);
            if (model?.runnerExports.has(binding.name) === true) {
                runners.add(binding.local);
            }
        }
        if (runners.size === 0) {
            continue;
        }
        const suppressed = suppressedLines(readText(testFile), 'b5');
        // A declaration whose initializer is `await <runner>…​.exec(` — the
        // `await using` form matches group 1 and is exempt.
        const binding =
            /\b(?<kind>await\s+using|const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*await\s+(?<runner>[A-Za-z_$][\w$]*)\b[^;]*?\.exec\s*\(/gu;
        for (const match of text.matchAll(binding)) {
            const kind = match.groups?.kind ?? '';
            const runner = match.groups?.runner ?? '';
            if (kind.startsWith('await using') || !runners.has(runner)) {
                continue;
            }
            const line = lineAt(text, match.index);
            if (suppressed.has(line)) {
                continue;
            }
            const rel = relative(rootDir, testFile);
            violations.push({
                file: rel,
                line,
                fix: `bind it with \`await using result = await ${runner}…\`, so the containers it started are removed at the end of the scope`,
                found: `a result of the docker-aware runner "${runner}" bound without \`await using\``,
                rule: 'b5-await-using-inference',
                severity: 'error',
            });
        }
    }
    return violations;
}

// ── A7 (database property) ───────────────────────────────────────────────────

/** Local inline runners a test declares itself (`specification.api(…)`). */
function localRunnerBindings(text: string): Set<string> {
    const locals = new Set<string>();
    const decl = new RegExp(
        String.raw`\{(?<names>[^}]*)\}\s*=\s*await\s+specification\.(?:${CONSTRUCTORS})\s*\(`,
        'gu',
    );
    for (const match of text.matchAll(decl)) {
        for (const raw of (match.groups?.names ?? '').split(',')) {
            const part = raw.trim();
            const local = (part.includes(':') ? (part.split(':')[1] ?? '') : part).trim();
            if (local.length > 0 && !NON_RUNNER_BINDINGS.has((part.split(':')[0] ?? '').trim())) {
                locals.add(local);
            }
        }
    }
    return locals;
}

/** The identifier immediately before a `.seed(`/`.table(` member, if any. */
function memberObjectIdentifier(text: string, dotIndex: number): null | string {
    const before = text.slice(0, dotIndex);
    const match = /(?<name>[A-Za-z_$][\w$]*)\s*$/u.exec(before);
    return match === null ? match : (match.groups?.name ?? null);
}

export function checkDatabaseProperty(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const enforced = new Map<string, SpecModel>();
    for (const file of listFiles(rootDir, (path) => path.endsWith('.specification.ts'))) {
        const model = modelSpecFile(file);
        if (
            model.sqlDatabaseCount !== null &&
            model.sqlDatabaseCount >= 1 &&
            model.runnerExports.size > 0
        ) {
            enforced.set(file, model);
        }
    }
    if (enforced.size === 0) {
        return violations;
    }

    for (const testFile of listFiles(rootDir, isNodeTestFileName)) {
        const text = readSource(testFile);
        // Which enforced specs does this test import? Enforce only when exactly
        // One applies (mixed DB configurations are ambiguous → skip).
        const applicable = new Set<SpecModel>();
        for (const binding of namedImports(text)) {
            const target = resolveRelativeImport(testFile, binding.source);
            const model = target === undefined ? undefined : enforced.get(target);
            if (model?.runnerExports.has(binding.name) === true) {
                applicable.add(model);
            }
        }
        const [onlyApplicable] = applicable;
        if (applicable.size !== 1 || onlyApplicable === undefined) {
            continue;
        }
        const count = onlyApplicable.sqlDatabaseCount ?? 0;
        const locals = localRunnerBindings(text);
        const suppressed = suppressedLines(readText(testFile), 'a7');
        const rel = relative(rootDir, testFile);

        for (const match of text.matchAll(/\.(?<verb>seed|table)\s*\(/gu)) {
            const verb = match.groups?.verb ?? '';
            const object = memberObjectIdentifier(text, match.index);
            // Skip calls dispatched on a runner the test declared itself.
            if (object !== null && locals.has(object)) {
                continue;
            }
            const args = balancedParens(text, text.indexOf('(', match.index));
            const hasDatabase = /\bdatabase\s*:/u.test(args);
            const line = lineAt(text, match.index);
            if (suppressed.has(line)) {
                continue;
            }
            if (count >= 2 && !hasDatabase) {
                violations.push({
                    file: rel,
                    line,
                    fix: `pass \`.${verb}(…, { database: '<key>' })\`, naming one of the ${count} databases the services record declares`,
                    found: `\`.${verb}()\` with no \`{ database }\`, while ${count} SQL databases are declared`,
                    rule: 'a7-database-property',
                    severity: 'error',
                });
            } else if (count === 1 && hasDatabase) {
                violations.push({
                    file: rel,
                    line,
                    fix: `delete the \`{ database }\` option of \`.${verb}()\``,
                    found: `\`.${verb}()\` passes \`{ database }\`, while a single SQL database is declared`,
                    rule: 'a7-database-property',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}

// ── C9 (dead fixtures + orphan dirs) ─────────────────────────────────────────

/** The disk, named anywhere: a `file(…)` or `directory(…)` call with a plain string argument. */
const DISK_CALL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

/**
 * What the referrers of one scan name, RESOLVED: the paths their literals
 * point at from the file that writes them, and the template-literal tables
 * they could ask for. An entry is referenced by the path that reaches it,
 * never by a literal that merely spells its name.
 */
type References = { paths: Set<string>; patterns: LiteralPattern[] };

/**
 * Every path `file` names, resolved. A document's keys are read from the
 * document. A source's `file()`/`directory()` arguments are read from the
 * file; so is each word of its other literals, and from the project root as
 * well — a path bound first to a name, or written into a command a process
 * service runs from the root (`node specs/shared/fixtures/app/server.mjs`).
 */
function referencesOf(file: string, into: References): void {
    const from = dirname(file);
    if (file.endsWith(SPEC_EXTENSION)) {
        for (const literal of collectSpecLiterals(file)) {
            into.paths.add(resolve(from, literal));
        }
        return;
    }
    for (const { path } of collectFixtureReferences(file, DISK_CALL)) {
        into.paths.add(resolve(from, path));
    }
    const anchor = specsAnchor(file);
    const bases = anchor === undefined ? [from] : [from, dirname(anchor.directory)];
    const text = readSource(file);
    for (const literal of collectLiterals(text)) {
        for (const word of literal.split(/\s+/u).filter((part) => part.length > 0)) {
            for (const base of bases) {
                into.paths.add(resolve(base, word));
            }
        }
    }
    into.patterns.push(...collectLiteralPatterns(text, from));
}

/** Is the entry at `path` — a ground file, or a tree — reached by a reference? */
function entryReferenced(path: string, references: References): boolean {
    const name = basename(path);
    for (const pattern of references.patterns) {
        if (
            pattern.directory === dirname(path) &&
            name.startsWith(pattern.prefix) &&
            name.endsWith(pattern.suffix)
        ) {
            return true;
        }
    }
    for (const reached of references.paths) {
        if (reached === path || isWithin(path, reached)) {
            return true;
        }
    }
    return false;
}

/** A child named like a ground subdir but actually a fixture container. */
function isConventionalSubdir(path: string): boolean {
    if (!isDir(path)) {
        return false;
    }
    // A real seeds/expected/… holds leaf fixtures: never a test, never a
    // Nested ground subdir (those signal a feature dir named like one).
    const files = listFiles(path, isTestFileName);
    if (files.length > 0) {
        return false;
    }
    let children;
    try {
        children = treeEntries(path);
    } catch {
        return false;
    }
    return !children.some((child) => child.isDirectory() && GROUND_SUBDIRS.has(child.name));
}

export function checkDeadFixtures(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const dir of listDirs(rootDir)) {
        // The specs root is no feature: its shared ground is scanned separately.
        if (basename(dir) === 'specs') {
            continue;
        }
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            continue;
        }
        const groundSubdirs = entries
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    GROUND_SUBDIRS.has(entry.name) &&
                    isConventionalSubdir(join(dir, entry.name)),
            )
            .map((entry) => entry.name);
        if (groundSubdirs.length === 0) {
            continue;
        }
        const feature = basename(dir);
        const testFiles = entries
            .filter((entry) => entry.isFile() && isReferrer(entry.name))
            .map((entry) => join(dir, entry.name));
        const rel = relative(rootDir, dir);

        // A domain owns 1..n `<aspect>.test.ts` (C1') — the ground is dead
        // Weight only when the domain carries no test at all.
        if (testFiles.length === 0) {
            violations.push({
                file: rel,
                line: 1,
                fix: `write the test that stands on ${groundSubdirs.join(', ')}, or delete the folder`,
                found: `a domain folder holding ${groundSubdirs.join(', ')} and no test or document`,
                rule: 'c9-dead-fixtures',
                severity: 'error',
            });
            continue;
        }

        const references: References = { paths: new Set(), patterns: [] };
        let downgrade = false;
        for (const testFile of testFiles) {
            referencesOf(testFile, references);
            if (!testFile.endsWith(SPEC_EXTENSION)) {
                downgrade ||= hasNonLiteralFixtureArg(readSource(testFile));
            }
        }
        const severity: Severity = downgrade ? 'warn' : 'error';

        for (const sub of groundSubdirs) {
            const subPath = join(dir, sub);
            for (const entry of treeEntries(subPath)) {
                if (entryReferenced(join(subPath, entry.name), references)) {
                    continue;
                }
                const relEntry = relative(rootDir, join(subPath, entry.name));
                violations.push({
                    file: relEntry,
                    line: 1,
                    fix: `delete ${sub}/${entry.name}, or name it from the test that stands on it`,
                    found: `${sub}/${entry.name}, which no test of ${feature} names`,
                    rule: 'c9-dead-fixtures',
                    severity,
                });
            }
        }
    }
    violations.push(...checkPoolFixtures(rootDir));
    return violations;
}

/** Unreferenced top-level entries of the pools (`specs/shared/fixtures/`, `specs/shared/seeds/`, …). */
function checkPoolFixtures(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const pool of findPools(rootDir)) {
        const specsRoot = specsRootOfPool(pool);
        // Every reference in the specs tree, excluding those made from
        // Inside the pool itself (a dead entry cannot vouch for another).
        const references: References = { paths: new Set(), patterns: [] };
        for (const file of listReferrers(specsRoot, pool)) {
            referencesOf(file, references);
        }
        for (const entry of treeEntries(pool)) {
            if (!entryReferenced(join(pool, entry.name), references)) {
                const relEntry = relative(rootDir, join(pool, entry.name));
                violations.push({
                    file: relEntry,
                    line: 1,
                    fix: `delete ${entry.name}, or name it from the specs that share it`,
                    found: `the pool entry ${entry.name}, which no spec under ${relative(rootDir, specsRoot) || basename(specsRoot)} names`,
                    rule: 'c9-dead-fixtures',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}

// ── C28's level half / C15 (where ground lives) ────────────────────────────────────────────

/** One fixture reference: the path a spec named, and where it named it. */
type FixtureReference = {
    /** Where the path's literal starts; a document entry points at its line. */
    column: number;
    file: string;
    /** The document key that names the path — absent for a `file()`/`directory()` call. */
    key?: string;
    /** What the path names: its wrapper, or what a document key reads. */
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

/** A fixture, named by a wrapper with a plain string argument. */
const FIXTURE_CALL =
    /\.fixture\(\s*(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

/**
 * Every fixture path a spec file names, with the line it names it on. A
 * `<case>.spec.yaml` is read through the runner's own parser; a `.ts` file
 * through the literal arguments `pattern` matches — a non-literal argument is
 * out of static reach and stays silent (the checker doctrine: precision over
 * recall).
 */
function collectFixtureReferences(
    file: string,
    pattern = FIXTURE_CALL,
    codeOnly = false,
): FixtureReference[] {
    if (file.endsWith(SPEC_EXTENSION)) {
        try {
            return documentPaths(parseSpecDocument(readText(file), file)).map(
                ({ key, kind, line, path }) => ({ column: 1, file, key, kind, line, path }),
            );
        } catch {
            return [];
        }
    }
    const text = readSource(file);
    const quoted = codeOnly ? stringMask(text) : [];
    const references: FixtureReference[] = [];
    for (const match of text.matchAll(pattern)) {
        if (quoted[match.index] === true) {
            continue;
        }
        const path = match.groups?.path;
        // A template with a hole names whatever it is handed: out of static reach.
        if (path !== undefined && path.length > 0 && isRelativePath(path) && !path.includes('${')) {
            const at = match.index + match[0].lastIndexOf(`${match.groups?.quote ?? ''}${path}`);
            references.push({
                column: columnAt(text, at),
                file,
                kind: match.groups?.kind === 'directory' ? 'directory' : 'file',
                line: lineAt(text, at),
                path,
            });
        }
    }
    return references;
}

/**
 * Which indexes of `text` (comments already blanked) sit inside a string
 * literal. A template is read whole as a string: a call inside `${…}` is out
 * of reach, which a precision-over-recall pass accepts.
 */
function stringMask(text: string): boolean[] {
    const mask: boolean[] = [];
    let quote = '';
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index] ?? '';
        if (quote === '') {
            quote = char === '"' || char === "'" || char === '`' ? char : '';
            mask[index] = quote !== '';
        } else {
            mask[index] = true;
            if (char === '\\') {
                index += 1;
                mask[index] = true;
            } else if (char === quote) {
                quote = '';
            }
        }
    }
    return mask;
}

/** Every spec file of a tree that may name a fixture, the pool excluded. */
function listReferrers(specsRoot: string, pool: string): string[] {
    return listFiles(
        specsRoot,
        (path) => path.endsWith('.ts') || path.endsWith(SPEC_EXTENSION),
    ).filter((file) => !file.startsWith(`${pool}/`) && !file.startsWith(`${pool}\\`));
}

/** The pool entry a path names from `file` — the FIRST segment below the pool. */
function poolEntryOf(file: string, path: string, pool: string): string | undefined {
    const inPool = relative(pool, resolve(dirname(file), path));
    if (inPool === '' || inPool.startsWith('..') || isAbsolute(inPool)) {
        return undefined;
    }
    const entry = inPool.split(sep)[0] ?? '';
    return entry.length > 0 ? entry : undefined;
}

/** Pool entry → the spec directories that reference it, each with its referrers. */
function poolUsage(specsRoot: string, pool: string): Map<string, Map<string, string[]>> {
    const usage = new Map<string, Map<string, string[]>>();
    for (const file of listReferrers(specsRoot, pool)) {
        for (const { path } of collectFixtureReferences(file, DISK_CALL, true)) {
            const entry = poolEntryOf(file, path, pool);
            if (entry === undefined) {
                continue;
            }
            const leaves = usage.get(entry) ?? new Map<string, string[]>();
            const referrers = leaves.get(dirname(file)) ?? [];
            if (!referrers.includes(file)) {
                referrers.push(file);
            }
            leaves.set(dirname(file), referrers);
            usage.set(entry, leaves);
        }
    }
    return usage;
}

/**
 * The leaf every one of `leaves` is, or sits under: the one leaf, or the
 * route's that encloses the others — `undefined` when they only meet above
 * any leaf, where the pool is their common level.
 */
function commonLeaf(leaves: readonly string[]): string | undefined {
    const [first, ...others] = leaves;
    if (first === undefined) {
        return undefined;
    }
    let common = first;
    while (!others.every((leaf) => leaf === common || isWithin(common, leaf))) {
        const parent = dirname(common);
        if (parent === common) {
            return undefined;
        }
        common = parent;
    }
    return leaves.includes(common) || (others.length > 0 && isLeaf(common)) ? common : undefined;
}

/** A pool entry only one leaf reaches for, and the leaf it belongs to. */
type MisplacedPoolFixture = {
    entry: string;
    leaf: string;
    pool: string;
    referrers: string[];
};

/**
 * The pool entries the member's module tests name by a relative literal. A
 * module test reads its ground outside every leaf, so an entry one of them
 * names is shared, whatever the leaves say.
 */
function poolEntriesModuleTestsRead(moduleTests: readonly string[], pool: string): Set<string> {
    const read = new Set<string>();
    for (const file of moduleTests) {
        for (const { value } of relativeLiterals(readText(file))) {
            const entry = poolEntryOf(file, value, pool);
            if (entry !== undefined) {
                read.add(entry);
            }
        }
    }
    return read;
}

/**
 * Pool entries — a file or a directory, in any of the four pools — reached
 * from exactly ONE spec directory, and named by no module test of the member.
 * Two documents of the same leaf count as one — the unit is the folder, not
 * the file. An entry no reference names at all is C9's dead-fixture case, not
 * this one.
 */
function misplacedPoolFixtures(rootDir: string): MisplacedPoolFixture[] {
    const misplaced: MisplacedPoolFixture[] = [];
    const moduleTests = new Map<string, string[]>();
    for (const pool of findPools(rootDir)) {
        const specsRoot = specsRootOfPool(pool);
        const member = dirname(specsRoot);
        const tests = moduleTests.get(member) ?? moduleTestsOf(member);
        moduleTests.set(member, tests);
        const readOutside = poolEntriesModuleTestsRead(tests, pool);
        for (const [entry, leaves] of poolUsage(specsRoot, pool)) {
            const leaf = commonLeaf([...leaves.keys()]);
            if (
                leaf === undefined ||
                readOutside.has(entry) ||
                treeKind(join(pool, entry)) === undefined
            ) {
                continue;
            }
            misplaced.push({ entry, leaf, pool, referrers: [...leaves.values()].flat() });
        }
    }
    return misplaced;
}

/**
 * CONVENTIONS C28, its level half — a pool entry is SHARED, or it is local. An entry of one of
 * the specs root's shared folders — `shared/fixtures/`, `shared/seeds/`,
 * `shared/requests/`, `shared/expected/` — that exactly one spec directory
 * reaches for, and no module test of the member names, is misplaced: it
 * belongs beside that leaf, in the leaf's folder of the same role
 * (`<leaf>/seeds/<name>`), named by the path from the leaf (`./seeds/<name>`).
 *
 * The catch: a fixture built for one scenario and parked in the pool reads as
 * shared ground. Every later author assumes some other spec depends on it, so
 * nobody dares change it — and the one spec that actually owns it is a directory
 * away, invisible. Fixed by `--fix`, which moves the tree and rewrites the
 * referrers.
 */
export function checkPoolFixtureSharing(rootDir: string): TokenViolation[] {
    return misplacedPoolFixtures(rootDir).map(({ entry, leaf, pool, referrers }) => {
        const relEntry = relative(rootDir, join(pool, entry));
        const relLeaf = relative(rootDir, leaf);
        const role = basename(pool);
        const named = isDir(join(pool, entry))
            ? `directory('./${role}/${entry}/')`
            : `file('./${role}/${entry}')`;
        const nested = referrers.some((file) => dirname(file) !== leaf);
        return {
            file: relEntry,
            line: 1,
            fix: nested
                ? `move it to ${relLeaf}/${role}/${entry}, the route's own ground, and name it from each leaf — ${named} there, the path that climbs to it from the leaves inside — \`make fix\` does both`
                : `move it to ${relLeaf}/${role}/${entry} and name it ${named} — \`make fix\` does both`,
            found: nested
                ? `a pool entry only ${relLeaf} and the leaves inside it reach for`
                : `a pool entry only ${relLeaf} reaches for`,
            rule: 'c28-ground-shared-or-inline',
            severity: 'error',
        };
    });
}

/**
 * Apply C28's level half: move each single-reader pool entry beside its leaf and rewrite the
 * paths that climbed to it into the path from the leaf — no module test names
 * it, or it would be shared. The move is a `git mv`
 * in a work tree, so the moved fixture keeps its history; a plain rename elsewhere.
 * A pool the move empties goes with it, and the shared folder when it was the
 * last, as C27's leaf folder does. Returns what
 * moved, relative to `rootDir`.
 */
export function fixPoolFixtures(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { entry, leaf, pool, referrers } of misplacedPoolFixtures(rootDir)) {
        const role = basename(pool);
        const destination = join(leaf, role, entry);
        if (existsSync(destination)) {
            continue; // Something already sits there — the author decides.
        }
        mkdirSync(dirname(destination), { recursive: true });
        moveKeepingHistory(join(pool, entry), destination);
        for (const file of referrers) {
            const text = readText(file);
            const climb = relative(dirname(file), pool).split(sep).join('/');
            const down = relative(dirname(file), join(leaf, role)).split(sep).join('/');
            const next = text.replaceAll(
                `${climb}/${entry}`,
                `${down.startsWith('.') ? down : `./${down}`}/${entry}`,
            );
            if (next !== text) {
                writeFileSync(file, next);
            }
        }
        removeIfEmpty(pool);
        removeIfEmpty(dirname(pool));
        moved.push(`${relative(rootDir, join(pool, entry))} → ${relative(rootDir, destination)}`);
    }
    return moved;
}

// ── C27 (ground copied across leaves) ────────────────────────────────────────

/**
 * What an entry of ground holds, as one string two copies share: a file's
 * bytes, a tree's every file by its path below the entry — the listing git
 * keeps, so an ignored file is no difference.
 */
function fingerprintOf(path: string): string {
    const hash = createHash('sha256');
    const visit = (current: string, below: string): void => {
        if (!isDir(current)) {
            hash.update(`${below}\0`);
            hash.update(readFileSync(current));
            hash.update('\0');
            return;
        }
        const children = treeEntries(current)
            .map((child) => child.name)
            .toSorted();
        for (const name of children) {
            visit(join(current, name), `${below}/${name}`);
        }
    };
    visit(path, '');
    return `${isDir(path) ? 'tree' : 'file'}:${hash.digest('hex')}`;
}

/** Remove a folder that holds nothing. */
function removeIfEmpty(folder: string): void {
    if (existsSync(folder) && readdirSync(folder).length === 0) {
        rmSync(folder, { recursive: true });
    }
}

/** One entry of ground copied into several leaves, and where the copies belong. */
type CopiedGround = {
    /** The copies, sorted — the first is the one a fix moves. */
    copies: string[];
    /** What every copy holds. */
    fingerprint: string;
    /**
     * The specs root's shared folder of the copies' role, holding the entry by its
     * name — or `null` when the copies go by several names, and none of them
     * is the one to keep.
     */
    target: null | string;
};

/** The leaf ground entries of `specsRoot`, grouped by their role and what they hold — whatever their names. */
function leafGroundOf(
    specsRoot: string,
): Map<string, { copies: string[]; fingerprint: string; role: string }> {
    const groups = new Map<string, { copies: string[]; fingerprint: string; role: string }>();
    for (const dir of listDirs(specsRoot)) {
        if (dir === specsRoot) {
            continue;
        }
        for (const role of GROUND_DIRS) {
            const ground = join(dir, role);
            if (!isConventionalSubdir(ground)) {
                continue;
            }
            for (const entry of treeEntries(ground)) {
                const path = join(ground, entry.name);
                const fingerprint = fingerprintOf(path);
                const key = `${role}\0${fingerprint}`;
                const group = groups.get(key) ?? { copies: [], fingerprint, role };
                group.copies.push(path);
                groups.set(key, group);
            }
        }
    }
    return groups;
}

/**
 * Ground entries — a file or a tree — that two leaves or more hold byte for
 * byte under the same role, by one name or by several.
 */
function copiedGround(rootDir: string): CopiedGround[] {
    const copied: CopiedGround[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        for (const { copies, fingerprint, role } of leafGroundOf(specsRoot).values()) {
            const leaves = new Set(copies.map((copy) => dirname(dirname(copy))));
            if (leaves.size < 2) {
                continue;
            }
            const names = new Set(copies.map((copy) => basename(copy)));
            const [name] = names;
            copied.push({
                copies: copies.toSorted(),
                fingerprint,
                target:
                    names.size === 1 && name !== undefined
                        ? join(specsRoot, SHARED_GROUND, role, name)
                        : null,
            });
        }
    }
    return copied;
}

/** What a copy's warning ends on: where the entry goes, or why `--fix` leaves it. */
function copyAdvice(rootDir: string, { fingerprint, target }: CopiedGround): string {
    if (target === null) {
        return 'give the copies the one name the entry should keep — they go by several, so `make fix` moves none';
    }
    const where = relative(rootDir, target);
    if (treeKind(target) !== undefined && fingerprintOf(target) !== fingerprint) {
        return `keep one copy in ${where} — it holds another ${basename(target)}, so rename one of the two first`;
    }
    return `keep one copy in ${where} — \`make fix\` moves it there and rewrites every path that named a copy`;
}

/**
 * CONVENTIONS C27 — ground several leaves share lives once. An entry of a
 * leaf's ground that another leaf holds byte for byte, under the same role,
 * is a copy, whatever it is called: it belongs in the specs root's shared
 * folder of its role, named by the path that climbs to it.
 *
 * The catch: a seed copied into every leaf that needs it. The copies drift —
 * one leaf's gains a column, the next does not — and the reader of either
 * cannot tell a deliberate difference from a forgotten one. A warning, since
 * two leaves may mean to diverge tomorrow; `--fix` moves one copy and rewrites
 * every path that named any of them — only when the copies share one name,
 * since that name is the only one a fix could keep.
 */
export function checkCopiedGround(rootDir: string): TokenViolation[] {
    return copiedGround(rootDir).flatMap((group) => {
        const advice = copyAdvice(rootDir, group);
        return group.copies.map((copy) => ({
            file: relative(rootDir, copy),
            line: 1,
            fix: advice,
            found: `the same ${isDir(copy) ? 'tree' : 'file'} as ${group.copies
                .filter((other) => other !== copy)
                .map((other) => relative(rootDir, other))
                .join(', ')}`,
            rule: 'c27w-duplicate-ground',
            severity: 'warn' as const,
        }));
    });
}

/** `to`, as the relative path a file in `from` names it by. */
function pathFrom(from: string, to: string): string {
    const rest = relative(from, to).split(sep).join('/');
    return rest.startsWith('.') ? rest : `./${rest}`;
}

/** An entry a fixer moves: where it was, and where it goes. */
type Move = { copy: string; target: string };

/** `path`, written from `from`, moved from the entry `copy` to the entry `target` — or `undefined` when it names no part of the copy. */
function repointed(from: string, path: string, { copy, target }: Move): string | undefined {
    const reached = resolve(from, path);
    if (reached !== copy && !isWithin(copy, reached)) {
        return undefined;
    }
    const moved = pathFrom(from, join(target, relative(copy, reached)));
    return path.endsWith('/') && !moved.endsWith('/') ? `${moved}/` : moved;
}

/** Every relative path a source writes as a whole string literal, a template with a hole left out, with its span. */
function relativeLiterals(text: string): { end: number; start: number; value: string }[] {
    const scanned = blankComments(text);
    return literalSpans(scanned).flatMap(({ end, start }) => {
        const value = scanned.slice(start + 1, end - 1);
        const quoted = `'"\``.includes(scanned[start] ?? '') && !value.includes('${');
        return quoted && isRelativePath(value) ? [{ end, start, value }] : [];
    });
}

/** The literal paths a source writes, rewritten where one names a copy. */
function repointSource(file: string, move: (path: string) => string | undefined): string {
    const text = readText(file);
    let next = '';
    let last = 0;
    for (const { end, start, value } of relativeLiterals(text)) {
        const moved = move(value);
        if (moved !== undefined) {
            next += `${text.slice(last, start + 1)}${moved}`;
            last = end - 1;
        }
    }
    return `${next}${text.slice(last)}`;
}

/** The paths a document's keys name, rewritten on their lines where one names a copy. */
function repointDocument(file: string, move: (path: string) => string | undefined): string {
    const text = readText(file);
    let named;
    try {
        named = documentPaths(parseSpecDocument(text, file));
    } catch {
        return text;
    }
    const lines = text.split('\n');
    for (const { line, path } of named) {
        const moved = move(path);
        const at = line - 1;
        if (moved === undefined || lines[at] === undefined) {
            continue;
        }
        const escaped = path.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
        lines[at] = lines[at].replace(
            new RegExp(String.raw`(^|[\s'"[,])${escaped}(?=$|[\s'"\],])`, 'u'),
            (_whole, lead: string) => `${lead}${moved}`,
        );
    }
    return lines.join('\n');
}

/**
 * Rewrite, in every module test of the member holding `specsRoot`, the
 * relative literals that name a moved entry: a module test stands on the
 * ground it names as a spec does, so the path follows the move. Returns the
 * files rewritten.
 */
export function repointModuleTests(specsRoot: string, moves: readonly Move[]): string[] {
    const rewritten: string[] = [];
    for (const file of moduleTestsOf(dirname(specsRoot))) {
        const from = dirname(file);
        const text = readText(file);
        const next = repointSource(file, (path) =>
            moves.map((each) => repointed(from, path, each)).find((moved) => moved !== undefined),
        );
        if (next !== text) {
            writeFileSync(file, next);
            rewritten.push(file);
        }
    }
    return rewritten;
}

/**
 * Apply C27: one copy of each copied entry moves to the specs root's shared
 * folder of its role — a `git mv` in a work tree — the others are deleted, and every
 * path of the specs tree and of the member's module tests that named a copy
 * names the moved entry. An entry the
 * target already holds byte for byte keeps it and deletes every copy; one
 * holding something else is the author's call, and nothing moves; so are
 * copies of several names. A leaf's ground folder the move empties goes with it. Returns
 * what moved, relative to `rootDir`.
 */
export function fixCopiedGround(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { copies, fingerprint, target } of copiedGround(rootDir)) {
        if (target === null) {
            continue;
        }
        const held = treeKind(target) !== undefined;
        if (held && fingerprintOf(target) !== fingerprint) {
            continue;
        }
        const specsRoot = specsRootOfPool(dirname(target));
        for (const file of listFiles(specsRoot, isReferrer)) {
            const from = dirname(file);
            const move = (path: string): string | undefined =>
                copies
                    .map((copy) => repointed(from, path, { copy, target }))
                    .find((next) => next !== undefined);
            const text = readText(file);
            const next = file.endsWith(SPEC_EXTENSION)
                ? repointDocument(file, move)
                : repointSource(file, move);
            if (next !== text) {
                writeFileSync(file, next);
            }
        }
        repointModuleTests(
            specsRoot,
            copies.map((copy) => ({ copy, target })),
        );
        const [first, ...others] = copies;
        if (first !== undefined && !held) {
            mkdirSync(dirname(target), { recursive: true });
            moveKeepingHistory(first, target);
        }
        for (const copy of held ? copies : others) {
            rmSync(copy, { force: true, recursive: true });
        }
        for (const ground of new Set(copies.map((copy) => dirname(copy)))) {
            if (existsSync(ground) && readdirSync(ground).length === 0) {
                rmSync(ground, { recursive: true });
            }
        }
        moved.push(
            `${copies.map((copy) => relative(rootDir, copy)).join(', ')} → ${relative(rootDir, target)}`,
        );
    }
    return moved;
}

/** Does this folder hold a test of its own — is it a leaf? */
function isLeaf(directory: string): boolean {
    return treeEntries(directory).some(
        (entry) =>
            entry.isFile() && (isTestFileName(entry.name) || entry.name.endsWith(SPEC_EXTENSION)),
    );
}

/**
 * The ground folders of the leaves that enclose `leaf` below the specs root —
 * a route's, reached from the leaf of a route under it (`map/pois/` holds the
 * ground `map/pois/detail/` shares with it).
 */
function enclosingGround(specsRoot: string, leaf: string): string[] {
    const ground: string[] = [];
    for (let folder = dirname(leaf); isWithin(specsRoot, folder) && folder !== specsRoot;) {
        if (isLeaf(folder)) {
            ground.push(...GROUND_DIRS.map((role) => join(folder, role)));
        }
        const parent = dirname(folder);
        if (parent === folder) {
            break;
        }
        folder = parent;
    }
    return ground;
}

/** The ground folders at the specs root itself — the shared ground outside `shared/`. */
function rootGroundOf(specsRoot: string): string[] {
    return GROUND_DIRS.map((role) => join(specsRoot, role)).filter((folder) => isDir(folder));
}

/**
 * CONVENTIONS C15 — a path leaves its leaf only into the specs root's shared
 * ground, or into the ground of a leaf that encloses it. Every `file()` and
 * `directory()` names its entry from the spec file; a path whose target stays
 * under the spec's own directory is the leaf's ground, one under
 * `<specs>/shared/fixtures/`, `seeds/`, `requests/` or `expected/` is a pool,
 * and anything else reaches into a sibling's ground — a pool by another door,
 * with none of its visibility. A role folder at the specs root itself
 * (`<specs>/seeds/`) is shared ground outside `shared/`: reported as a folder,
 * and every path into it as a path.
 *
 * The catch: a leaf quietly depending on a neighbour's ground. The neighbour's
 * author has no way to know, edits their own files, and breaks a spec two
 * folders away. Ground several leaves share belongs in the pool, where its
 * sharing is declared.
 */
export function checkLocalFixtureReach(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        const pools = poolsOf(specsRoot);
        for (const folder of rootGroundOf(specsRoot)) {
            const role = basename(folder);
            violations.push({
                file: relative(rootDir, folder),
                line: 1,
                fix: `move it to ${relative(rootDir, join(specsRoot, SHARED_GROUND, role))}/ — \`make fix\` moves it and rewrites every path that names it`,
                found: `${role}/ at the specs root, shared ground outside ${relative(rootDir, join(specsRoot, SHARED_GROUND))}/`,
                rule: 'c15-local-fixture-reach',
                severity: 'error',
            });
        }
        for (const file of listReferrers(specsRoot, join(specsRoot, SHARED_GROUND))) {
            const leaf = dirname(file);
            for (const { column, line, path } of collectFixtureReferences(file, DISK_CALL)) {
                const target = resolve(leaf, path);
                if (
                    isWithin(leaf, target) ||
                    pools.some((pool) => isWithin(pool, target)) ||
                    enclosingGround(specsRoot, leaf).some((ground) => isWithin(ground, target))
                ) {
                    continue;
                }
                const rel = relative(rootDir, file);
                violations.push({
                    column,
                    file: rel,
                    line,
                    fix: `move what it names beside ${relative(rootDir, leaf)}, or — when several leaves share it — into the specs root's shared folder of its role: ${pools.map((pool) => `${relative(rootDir, pool)}/`).join(', ')}`,
                    found: `"${path}" leaves ${relative(rootDir, leaf)}`,
                    rule: 'c15-local-fixture-reach',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}

/**
 * Apply C15 to the shared ground outside `shared/`: every entry of a role
 * folder at the specs root moves to the shared folder of its role — a `git mv`
 * in a work tree — and every path that named it, a source's literal or a
 * document's key of the specs tree, a module test's relative literal, names it
 * there. An entry the shared folder
 * already holds by that name stays, for the author. A root folder the move
 * empties goes with it. Returns what moved, relative to `rootDir`.
 */
export function fixRootGround(rootDir: string): string[] {
    const moved: string[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        for (const folder of rootGroundOf(specsRoot)) {
            const shared = join(specsRoot, SHARED_GROUND, basename(folder));
            const moves = treeEntries(folder)
                .map((entry) => ({
                    copy: join(folder, entry.name),
                    target: join(shared, entry.name),
                }))
                .filter(({ target }) => !existsSync(target));
            if (moves.length === 0) {
                continue;
            }
            for (const file of listReferrers(specsRoot, folder)) {
                const from = dirname(file);
                const move = (path: string): string | undefined =>
                    moves
                        .map((each) => repointed(from, path, each))
                        .find((next) => next !== undefined);
                const text = readText(file);
                const next = file.endsWith(SPEC_EXTENSION)
                    ? repointDocument(file, move)
                    : repointSource(file, move);
                if (next !== text) {
                    writeFileSync(file, next);
                }
            }
            repointModuleTests(specsRoot, moves);
            mkdirSync(shared, { recursive: true });
            for (const { copy, target } of moves) {
                moveKeepingHistory(copy, target);
            }
            removeIfEmpty(folder);
            moved.push(`${relative(rootDir, folder)}/ → ${relative(rootDir, shared)}/`);
        }
    }
    return moved;
}

/**
 * CONVENTIONS C8 — every path a test names exists, as what it says it is.
 *
 * A `file()` or `directory()` with a literal path, a document's `fixture:`,
 * and a path the test resolves from its own directory, each resolved from the
 * test's own directory: a path that names nothing, a `file()` naming a
 * directory, or a `directory()` naming a file is reported at
 * the path. Inside a git work tree a path names only what git does not
 * ignore: an ignored target is on this workstation and on no checkout. The
 * catch is the typo that would only fail a run — a test later,
 * far from the line that made it. A call written inside a string (a rule's
 * test case, a sample) is text, not a call, and is not read.
 */
/** A path naming nothing git keeps: what it names, and the gesture. */
function missingTarget(named: string, target: string, onDisk: boolean): Teaching {
    return onDisk
        ? {
              fix: `track ${target} (it is ignored by git), or name a file that is`,
              found: `${named} names nothing — ${target} is ignored by git`,
          }
        : {
              fix: `create ${target}, or correct the path`,
              found: `${named} names nothing — ${target} does not exist`,
          };
}

/** A path naming the other kind of entry than its wrapper says. */
function crossedTarget(
    named: string,
    { found, key, path }: { found: 'directory' | 'file'; key: string | undefined; path: string },
): Teaching {
    const bare = path.replace(/\/+$/u, '');
    const spelled = found === 'directory' ? `${bare}/` : bare;
    if (key === undefined) {
        return { fix: `write ${found}('${spelled}')`, found: `${named} names a ${found}` };
    }
    return {
        fix: key === 'fixture' ? `write "${spelled}"` : `${key}: reads one file — name one`,
        found: `${named} names a ${found}`,
    };
}

/**
 * A path a test resolves from its own directory with one literal —
 * `resolve(import.meta.dirname, '…')`, `join(…)` alike, `__dirname` alike —
 * and the same by URL, `new URL('…', import.meta.url)` — spelled `./` or `../`,
 * as a `file()` is. A path spelled into a
 * command a process runs is the author's: no pattern reads it.
 */
const ANCHORED_PATHS = [
    /(?<![\w$.])(?:path\.)?(?:join|resolve)\(\s*(?:import\.meta\.dirname|__dirname)\s*,\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>\s*,?\s*\)/gu,
    /(?<![\w$.])new\s+URL\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>\s*,\s*import\.meta\.url\s*,?\s*\)/gu,
];

/** The paths a source resolves from its own directory, each where its literal starts. */
function anchoredPaths(file: string): { column: number; line: number; path: string }[] {
    const text = readSource(file);
    const quoted = stringMask(text);
    return ANCHORED_PATHS.flatMap((pattern) =>
        [...text.matchAll(pattern)].flatMap((match) => {
            const path = match.groups?.path ?? '';
            if (quoted[match.index] === true || !isRelativePath(path) || path.includes('${')) {
                return [];
            }
            const at = match.index + match[0].lastIndexOf(`${match.groups?.quote ?? ''}${path}`);
            return [{ column: columnAt(text, at), line: lineAt(text, at), path }];
        }),
    );
}

export function diskTargetFindings(file: string, rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const suppressed = file.endsWith(SPEC_EXTENSION)
        ? new Set<number>()
        : suppressedLines(readText(file), 'c8');
    if (!file.endsWith(SPEC_EXTENSION)) {
        for (const { column, line, path } of anchoredPaths(file)) {
            const target = resolve(dirname(file), path);
            if (treeKind(target) !== undefined || suppressed.has(line)) {
                continue;
            }
            violations.push({
                column,
                file: relative(rootDir, file),
                line,
                ...missingTarget(`'${path}'`, relative(rootDir, target), existsSync(target)),
                rule: 'c8-disk-target-exists',
                severity: 'error',
            });
        }
    }
    for (const { column, key, kind, line, path } of collectFixtureReferences(
        file,
        DISK_CALL,
        true,
    )) {
        const target = resolve(dirname(file), path);
        const found = treeKind(target);
        if (found === kind || suppressed.has(line)) {
            continue;
        }
        const named = key === undefined ? `${kind}('${path}')` : `${key}: "${path}"`;
        violations.push({
            column,
            file: relative(rootDir, file),
            line,
            ...(found === undefined
                ? missingTarget(named, relative(rootDir, target), existsSync(target))
                : crossedTarget(named, { found, key, path })),
            rule: 'c8-disk-target-exists',
            severity: 'error',
        });
    }
    return violations;
}

/** C8 over every `specs/` tree below `rootDir` — its specs and its documents. */
export function checkDiskTargetsExist(rootDir: string): TokenViolation[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) =>
        listReferrers(specsRoot, join(specsRoot, SHARED_GROUND)).flatMap((file) =>
            diskTargetFindings(file, rootDir),
        ),
    );
}

/** Is `path` inside `directory` (strictly — a directory is not inside itself)? */
function isWithin(directory: string, path: string): boolean {
    const rest = relative(directory, path);
    return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

// ── J9 — a suppression states why (checker channel) ──────────────────────────

/** The directive, whatever precedes it on the line, and what follows the ids. */
const DIRECTIVE = /(?<lead>.*?)checker-disable(?:-next-line|-line)\s+(?<rest>.*)$/iu;

/**
 * A directive is written in a COMMENT — the word inside a string is a test
 * TALKING about suppressions, which is what this package's own suite does.
 */
const COMMENT_LEAD = /(?:^|\s)(?:\/\/|\/\*|\*|#)\s*$/u;

/** The files a directive can be written in — source, documents, goldens. */
const READABLE = /\.(?:[cm]?[jt]sx?|ya?ml|json|md|sql|http|txt)$/u;

/** Is this a file a human writes a directive in? */
function isReadableText(path: string): boolean {
    return READABLE.test(path);
}

/** The ids a directive names, or the placeholder a reader fills. */
function idOf(rest: string | undefined): string {
    const ids = rest?.trim() ?? '';
    return ids === '' ? '<id>' : ids;
}

/** A reason: the `--` separator with something after it. */
const REASON = /--\s*\S/u;

/**
 * J9 — every checker suppression says WHY.
 *
 * A suppression with no reason is a rule turned off by someone who is no longer
 * here: the next reader cannot tell whether the pass was wrong, the shape was
 * exceptional, or it was simply in the way — so the line survives every review
 * and the convention quietly stops holding. The toolchain's own
 * `suppressions-reason` gate reads `oxlint-disable*` and nothing else, which is
 * why this channel carries its own.
 */
export function checkSuppressionReason(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const file of listFiles(rootDir, isReadableText)) {
        const text = readText(file);
        if (!text.includes('checker-disable')) {
            continue;
        }
        for (const [index, line] of text.split('\n').entries()) {
            const match = DIRECTIVE.exec(line);
            if (
                match === null ||
                !COMMENT_LEAD.test(match.groups?.lead ?? '') ||
                REASON.test(match.groups?.rest ?? '')
            ) {
                continue;
            }
            const rel = relative(rootDir, file);
            violations.push({
                file: rel,
                line: index + 1,
                fix: `end the directive with its reason: \`checker-disable-next-line ${idOf(match.groups?.rest)} -- <why this line is the exception>\``,
                found: 'a checker suppression that does not say why',
                rule: 'j9-checker-suppression-reason',
                severity: 'error',
            });
        }
    }
    return violations;
}
