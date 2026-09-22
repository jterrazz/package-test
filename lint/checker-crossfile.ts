import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { GROUND_DIRS, GROUND_FIXTURES, isGroundName } from '../src/model/chain/ground.js';
import { isRelativePath } from '../src/model/chain/spec-path.js';
import { parseSpecDocument, SPEC_EXTENSION } from '../src/model/literate/spec-document.js';
import type { Severity, TokenViolation } from './checker.js';
import { isNodeTestFileName, isTestFileName } from './role.js';

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
 * - **C9 dead fixtures** — per feature dir, a fixture file no test literal
 *   references is dead weight; a feature dir with ground subdirs but no
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
 * - **C14 / C15 where a fixture lives** — a pool entry only ONE spec directory
 *   reaches for belongs beside that leaf (autofixed), and a path leaves its
 *   leaf only into the pool.
 */

/** Directories the cross-file walks never descend into. */
const PRUNED = new Set(['.git', 'dist', 'node_modules']);

/** The ground directories of a leaf — the files a spec stands on. */
const GROUND_SUBDIRS = new Set<string>(GROUND_DIRS);

/** Destructured names that are never a runner (so never the A7/B5 subject). */
const NON_RUNNER_BINDINGS = new Set(['cleanup', 'docker', 'orchestrator']);

/** The specification constructors whose records/options the passes read. */
const CONSTRUCTORS = 'api|cli|jobs';

/**
 * The pool (`.../specs/fixtures`) is verbatim fixture material — the
 * reusable apps AND the lint-violation trees that fail on purpose — never live
 * specs. The cross-file walks prune it (like the token checker skips
 * `fixtures/`); {@link checkPoolFixtures} inspects its top level separately.
 */
function isPool(dir: string): boolean {
    return basename(dir) === GROUND_FIXTURES && basename(dirname(dir)) === 'specs';
}

/**
 * Is this a directory the walks do not enter? Ground — the pool and every
 * leaf's own — holds material a spec stands on, never a live spec: a fixture
 * project with a `specs/` tree of its own is an input, judged where a spec
 * runs the checker over it.
 */
function isPruned(dir: string): boolean {
    return PRUNED.has(basename(dir)) || isGroundName(basename(dir));
}

/** Recursively list every file under `dir`, skipping pruned dirs and the pool. */
function listFiles(dir: string, predicate: (path: string) => boolean): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
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
            entries = readdirSync(current, { withFileTypes: true });
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
function findSpecsRoots(dir: string): string[] {
    const roots: string[] = [];
    const visit = (current: string): void => {
        if (basename(current) === 'specs') {
            roots.push(current);
            return;
        }
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
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
            entries = readdirSync(current, { withFileTypes: true });
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
function blankComments(text: string): string {
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
 * The fixture paths a `<case>.spec.yaml` names — its referrer literals. The
 * runner's own parser reads them, so the two channels cannot disagree about
 * what the document says; an unparseable file vouches for nothing (the
 * `d4b-spec-shape` pass is what reports it).
 */
function collectSpecLiterals(path: string): Set<string> {
    try {
        return new Set(
            parseSpecDocument(readText(path), path).fixtures.map((fixture) => fixture.path),
        );
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
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
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
 * a fixture whose name starts with `prefix` and ends with `suffix` is one the
 * table could have asked for, which is all C9 needs to stop calling it dead.
 */
export type LiteralPattern = { prefix: string; suffix: string };

const TEMPLATE_WITH_HOLE = /`(?<body>(?:[^`\\]|\\.)*\$\{(?:[^`\\]|\\.)*)`/gu;
function collectLiteralPatterns(text: string): LiteralPattern[] {
    const found: LiteralPattern[] = [];
    for (const match of text.matchAll(TEMPLATE_WITH_HOLE)) {
        const body = match.groups?.body ?? '';
        const opens = body.indexOf('${');
        const closes = body.lastIndexOf('}');
        if (opens === -1 || closes === -1 || closes < opens) {
            continue;
        }
        // The path's folders are the ground this entry sits in; the entry is
        // Matched on what the template states after the last of them.
        const prefix = body.slice(0, opens).split('/').at(-1) ?? '';
        const suffix = body.slice(closes + 1);
        // A template that is ALL hole names everything; it vouches for
        // Nothing in particular, and C9 already downgrades that file's
        // Findings to warn through `hasNonLiteralFixtureArg`.
        if (prefix.length > 0 || suffix.length > 0) {
            found.push({ prefix, suffix });
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
                message: `result of docker-aware runner "${runner}" must be bound with \`await using\` so its containers are disposed`,
                rule: 'b5',
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
                    message: `.${verb}() must pass { database } — ${count} SQL databases are declared`,
                    rule: 'a7',
                    severity: 'error',
                });
            } else if (count === 1 && hasDatabase) {
                violations.push({
                    file: rel,
                    line,
                    message: `.${verb}() must not pass { database } — a single SQL database is declared`,
                    rule: 'a7',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}

// ── C9 (dead fixtures + orphan dirs) ─────────────────────────────────────────

/** Is a top-level ground-subdir entry referenced by any test literal? */
function entryReferenced(
    entry: string,
    entryIsDir: boolean,
    literals: Set<string>,
    patterns: LiteralPattern[] = [],
): boolean {
    for (const pattern of patterns) {
        if (entry.startsWith(pattern.prefix) && entry.endsWith(pattern.suffix)) {
            return true;
        }
    }
    for (const literal of literals) {
        if (entryIsDir) {
            // A referenced `<name>/…` tree counts entirely as used.
            if (
                literal === entry ||
                literal.startsWith(`${entry}/`) ||
                literal.includes(`/${entry}`)
            ) {
                return true;
            }
        }
        if (literal === entry || literal.includes(entry)) {
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
        children = readdirSync(path, { withFileTypes: true });
    } catch {
        return false;
    }
    return !children.some((child) => child.isDirectory() && GROUND_SUBDIRS.has(child.name));
}

export function checkDeadFixtures(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const dir of listDirs(rootDir)) {
        // A `specs/fixtures` pool is not a feature; it is scanned separately.
        if (basename(dir) === 'specs') {
            continue;
        }
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
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
                message: `domain directory has ground subdirs (${groundSubdirs.join(', ')}) but no *.test.ts(x) or *.spec.yaml`,
                rule: 'c9',
                severity: 'error',
            });
            continue;
        }

        const literals = new Set<string>();
        const patterns: LiteralPattern[] = [];
        let downgrade = false;
        for (const testFile of testFiles) {
            if (testFile.endsWith(SPEC_EXTENSION)) {
                for (const literal of collectSpecLiterals(testFile)) {
                    literals.add(literal);
                }
                continue;
            }
            const text = readSource(testFile);
            for (const literal of collectLiterals(text)) {
                literals.add(literal);
            }
            patterns.push(...collectLiteralPatterns(text));
            downgrade ||= hasNonLiteralFixtureArg(text);
        }
        const severity: Severity = downgrade ? 'warn' : 'error';

        for (const sub of groundSubdirs) {
            const subPath = join(dir, sub);
            for (const entry of readdirSync(subPath, { withFileTypes: true })) {
                const entryIsDir = entry.isDirectory();
                if (entryReferenced(entry.name, entryIsDir, literals, patterns)) {
                    continue;
                }
                const relEntry = relative(rootDir, join(subPath, entry.name));
                violations.push({
                    file: relEntry,
                    line: 1,
                    message: `dead fixture — no test literal in ${feature} references ${sub}/${entry.name}`,
                    rule: 'c9',
                    severity,
                });
            }
        }
    }
    violations.push(...checkPoolFixtures(rootDir));
    return violations;
}

/** Unreferenced top-level entries of the pool (`specs/fixtures`). */
function checkPoolFixtures(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const pool of findPools(rootDir)) {
        const specsRoot = dirname(pool);
        // Every literal in the specs tree, excluding references made from
        // Inside the pool itself (a dead entry cannot vouch for another).
        const literals = new Set<string>();
        for (const file of listFiles(
            specsRoot,
            (path) => path.endsWith('.ts') || path.endsWith(SPEC_EXTENSION),
        )) {
            if (file.startsWith(`${pool}/`) || file.startsWith(`${pool}\\`)) {
                continue;
            }
            const found = file.endsWith(SPEC_EXTENSION)
                ? collectSpecLiterals(file)
                : collectLiterals(readSource(file));
            for (const literal of found) {
                literals.add(literal);
            }
        }
        for (const entry of readdirSync(pool, { withFileTypes: true })) {
            const referenced = [...literals].some((literal) => literal.includes(entry.name));
            if (!referenced) {
                const relEntry = relative(rootDir, join(pool, entry.name));
                violations.push({
                    file: relEntry,
                    line: 1,
                    message: `dead pool fixture — no spec under ${relative(rootDir, specsRoot) || basename(specsRoot)} references ${entry.name}`,
                    rule: 'c9',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}

// ── C14 / C15 (where a fixture lives) ────────────────────────────────────────

/** One fixture reference: the path a spec named, and where it named it. */
type FixtureReference = {
    /** Where the path's literal starts; a document entry points at its line. */
    column: number;
    file: string;
    /** What the path names: its wrapper, or a document entry's trailing `/`. */
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

/** A fixture, named by a wrapper with a plain string argument. */
const FIXTURE_CALL =
    /\.fixture\(\s*(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

/** The disk, named anywhere: a `file(…)` or `directory(…)` call with a plain string argument. */
const DISK_CALL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

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
            return parseSpecDocument(readText(file), file).fixtures.map((fixture) => ({
                column: 1,
                file,
                kind: fixture.path.endsWith('/') ? 'directory' : 'file',
                line: fixture.line,
                path: fixture.path,
            }));
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
        for (const { path } of collectFixtureReferences(file)) {
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

/** A pool entry only one leaf reaches for, and the leaf it belongs to. */
type MisplacedPoolFixture = {
    entry: string;
    leaf: string;
    pool: string;
    referrers: string[];
};

/**
 * Pool entries reached from exactly ONE spec directory. Two documents of the
 * same leaf count as one — the unit is the folder, not the file. An entry no
 * reference names at all is C9's dead-fixture case, not this one.
 */
function misplacedPoolFixtures(rootDir: string): MisplacedPoolFixture[] {
    const misplaced: MisplacedPoolFixture[] = [];
    for (const pool of findPools(rootDir)) {
        const usage = poolUsage(dirname(pool), pool);
        for (const [entry, leaves] of usage) {
            const [only] = leaves;
            if (leaves.size !== 1 || only === undefined || !isDir(join(pool, entry))) {
                continue;
            }
            const [leaf, referrers] = only;
            misplaced.push({ entry, leaf, pool, referrers });
        }
    }
    return misplaced;
}

/**
 * CONVENTIONS C14 — a pool fixture is SHARED, or it is local. A directory of the
 * specs-root `fixtures/` pool that exactly one spec directory reaches for is
 * misplaced: it belongs beside that leaf, as `<leaf>/fixtures/<name>/`, named by
 * the path from the leaf (`./fixtures/<name>/`).
 *
 * The catch: a fixture built for one scenario and parked in the pool reads as
 * shared ground. Every later author assumes some other spec depends on it, so
 * nobody dares change it — and the one spec that actually owns it is a directory
 * away, invisible. Fixed by `--fix`, which moves the tree and rewrites the
 * referrers.
 */
export function checkPoolFixtureSharing(rootDir: string): TokenViolation[] {
    return misplacedPoolFixtures(rootDir).map(({ entry, leaf, pool }) => {
        const relEntry = relative(rootDir, join(pool, entry));
        const relLeaf = relative(rootDir, leaf);
        return {
            file: relEntry,
            line: 1,
            message: `only ${relLeaf} reaches for this pool fixture — the pool is what SEVERAL leaves share; move it to ${relLeaf}/${GROUND_FIXTURES}/${entry} and reference it as directory('./${GROUND_FIXTURES}/${entry}/') — \`--fix\` does both`,
            rule: 'c14',
            severity: 'error',
        };
    });
}

/**
 * Apply C14: move each single-reader pool entry beside its leaf and rewrite the
 * paths that climbed to it into the path from the leaf. The move is a plain rename — the
 * checker never runs git, so the working tree sees it and the author stages it.
 * Returns what moved, relative to `rootDir`.
 */
export function fixPoolFixtures(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { entry, leaf, pool, referrers } of misplacedPoolFixtures(rootDir)) {
        const destination = join(leaf, GROUND_FIXTURES, entry);
        if (existsSync(destination)) {
            continue; // Something already sits there — the author decides.
        }
        mkdirSync(dirname(destination), { recursive: true });
        renameSync(join(pool, entry), destination);
        for (const file of referrers) {
            const text = readText(file);
            const climb = relative(dirname(file), pool).split(sep).join('/');
            const next = text.replaceAll(`${climb}/${entry}`, `./${GROUND_FIXTURES}/${entry}`);
            if (next !== text) {
                writeFileSync(file, next);
            }
        }
        moved.push(`${relative(rootDir, join(pool, entry))} → ${relative(rootDir, destination)}`);
    }
    return moved;
}

/**
 * CONVENTIONS C15 — a path leaves its leaf only into the pool. Every `file()`
 * and `directory()` names its entry from the spec file; a path whose target
 * stays under the spec's own directory is the leaf's ground, one under the
 * specs-root `fixtures/` is the pool, and anything else reaches into a
 * sibling's ground — the pool by another door, with none of its visibility.
 *
 * The catch: a leaf quietly depending on a neighbour's ground. The neighbour's
 * author has no way to know, edits their own files, and breaks a spec two
 * folders away. Ground several leaves share belongs in the pool, where its
 * sharing is declared.
 */
export function checkLocalFixtureReach(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const specsRoot of findSpecsRoots(rootDir)) {
        const pool = join(specsRoot, GROUND_FIXTURES);
        for (const file of listReferrers(specsRoot, pool)) {
            const leaf = dirname(file);
            for (const { column, line, path } of collectFixtureReferences(file, DISK_CALL)) {
                const target = resolve(leaf, path);
                if (isWithin(leaf, target) || isWithin(pool, target)) {
                    continue;
                }
                const rel = relative(rootDir, file);
                violations.push({
                    column,
                    file: rel,
                    line,
                    message: `"${path}" leaves ${relative(rootDir, leaf)} — a leaf's ground sits beside it; ground several leaves share goes to the pool at ${relative(rootDir, pool)}`,
                    rule: 'c15',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}

/** What a path names on disk, if anything. */
function entryKind(path: string): 'directory' | 'file' | undefined {
    try {
        return statSync(path).isDirectory() ? 'directory' : 'file';
    } catch {
        return undefined;
    }
}

/**
 * CONVENTIONS C8 — every path a test names exists, as what it says it is.
 *
 * A `file()` or `directory()` with a literal path, and a document's `fixture:`,
 * resolved from the test's own directory: a path that names nothing, a
 * `file()` naming a directory, or a `directory()` naming a file is reported at
 * the path. The catch is the typo that would only fail a run — a test later,
 * far from the line that made it. A call written inside a string (a rule's
 * test case, a sample) is text, not a call, and is not read.
 */
export function diskTargetFindings(file: string, rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const suppressed = file.endsWith(SPEC_EXTENSION)
        ? new Set<number>()
        : suppressedLines(readText(file), 'c8');
    for (const { column, kind, line, path } of collectFixtureReferences(file, DISK_CALL, true)) {
        const target = resolve(dirname(file), path);
        const found = entryKind(target);
        if (found === kind || suppressed.has(line)) {
            continue;
        }
        const bare = path.replace(/\/+$/u, '');
        const spelled = found === 'directory' ? `${bare}/` : bare;
        violations.push({
            column,
            file: relative(rootDir, file),
            line,
            message:
                found === undefined
                    ? `${kind}('${path}') names nothing — ${relative(rootDir, target)} does not exist`
                    : `${kind}('${path}') names a ${found} — write ${found}('${spelled}')`,
            rule: 'c8-disk-target-exists',
            severity: 'error',
        });
    }
    return violations;
}

/** C8 over every `specs/` tree below `rootDir` — its specs and its documents. */
export function checkDiskTargetsExist(rootDir: string): TokenViolation[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) =>
        listReferrers(specsRoot, join(specsRoot, GROUND_FIXTURES)).flatMap((file) =>
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
                message: `say why: \`checker-disable-next-line <id> -- <reason>\``,
                rule: 'j9-checker-suppression-reason',
                severity: 'error',
            });
        }
    }
    return violations;
}
