import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import {
    documentPaths,
    parseSpecDocument,
    SPEC_EXTENSION,
} from '../../src/facets/cli/documents/spec-document.js';
import { moveKeepingHistory, treeEntries, treeKind } from '../../src/kernel/files/git-tree.js';
import { GROUND_DIRS, isGroundName, SHARED_GROUND } from '../../src/kernel/files/ground.js';
import { isRelativePath } from '../../src/kernel/files/spec-path.js';
import type { Teaching } from '../catalogue/lesson.js';
import { isNode, nodeStart, specsAnchor } from '../reading/ast.js';
import { parseProgram } from '../reading/module-parser.js';
import { moduleTestsOf } from '../reading/module-tests.js';
import { literalPathVisitor, visitProgram } from '../reading/path-references.js';
import { isNodeTestFileName, isTestFileName } from '../reading/role.js';
import { literalSpans } from '../reading/spec-values.js';
import type { Severity, TokenViolation } from './checker.js';

/** Passes that read two files or a whole tree at once, which oxlint cannot; precision over recall: a heuristic that cannot decide stays silent. */

const PRUNED = new Set(['.git', 'dist', 'node_modules']);

const GROUND_SUBDIRS = new Set<string>(GROUND_DIRS);

const NON_RUNNER_BINDINGS = new Set(['cleanup', 'docker', 'orchestrator']);

const CONSTRUCTORS = 'api|cli|job';

function isSharedFolder(dir: string): boolean {
    return basename(dir) === SHARED_GROUND && basename(dirname(dir)) === 'specs';
}

function isPool(dir: string): boolean {
    return isGroundName(basename(dir)) && isSharedFolder(dirname(dir));
}

export function poolsOf(specsRoot: string): string[] {
    return GROUND_DIRS.map((ground) => join(specsRoot, SHARED_GROUND, ground));
}

function specsRootOfPool(pool: string): string {
    return dirname(dirname(pool));
}

/** A fixture project with a `specs/` tree of its own is an input, judged where a spec runs the checker over it. */
function isPruned(dir: string): boolean {
    return PRUNED.has(basename(dir)) || isGroundName(basename(dir)) || isSharedFolder(dir);
}

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

/** Newlines survive and strings stay untouched, so offsets and line numbers still hold. */
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

function readSource(path: string): string {
    return blankComments(readText(path));
}

/** Read through the runner's own parser, so the two channels cannot disagree; an unparseable file vouches for nothing (`d4b-spec-shape` reports it). */
function collectSpecLiterals(path: string): Set<string> {
    try {
        const document = parseSpecDocument(readText(path), path);
        return new Set(documentPaths(document).map((named) => named.path));
    } catch {
        return new Set();
    }
}

/** A document counts: a rendered unit's ARIA golden sits in the same `expected/` as a spec's. */
function isReferrer(name: string): boolean {
    return isTestFileName(name) || name.endsWith(SPEC_EXTENSION);
}

function isDir(path: string): boolean {
    return treeKind(path) === 'directory';
}

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

/** Over-collection only ever hides a dead-fixture finding, so a greedy regex is safe. */
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

/** The hole is unreadable but its static ends are not: an entry matching the prefix and suffix could be asked for by the table, which is all C9 needs. */
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
        const before = body.slice(0, opens);
        const cut = before.lastIndexOf('/');
        const prefix = before.slice(cut + 1);
        const suffix = body.slice(closes + 1);
        // An all-hole template vouches for nothing; C9 already downgrades that file to warn through `hasNonLiteralFixtureArg`.
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

/** A non-literal path makes the reference set incomplete, so the feature is reported at warn: a false positive would be worse than a miss. */
const DISK_ARG = /(?<![.\w])(?:file|directory)\s*\(\s*(?<arg>[^,)]*)/gu;
const DISK_VERB_ARG = /\.(?:seed|request|fixture|run)\s*\(\s*(?<arg>[^,)]*)/gu;

const PLAIN_STRING = /^(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`$\\]|\\.)*`)$/u;

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

/** `// checker-disable-next-line <id>[,<id>] -- reason`, stepping over blank lines and other tools' directives; `checker-disable-line` for its own line. */
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
        // Case-insensitive: the formatter capitalizes comment leads (`checker-…` → `Checker-…`).
        let match = /checker-disable-next-line\s+(?<ids>.*)$/iu.exec(line);
        if (match !== null && applies(match.groups?.ids ?? '')) {
            // A directive of another tool may stand between, since each also claims the next line.
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

type SpecModel = {
    dockerAware: boolean;
    file: string;
    runnerExports: Set<string>;
    /** `null` when the record is absent or not a plain literal: A7 cannot be decided then. */
    sqlDatabaseCount: null | number;
};

function runnerExportsOf(text: string): Set<string> {
    const names = new Set<string>();
    const decl = new RegExp(
        String.raw`\{(?<names>[^}]*)\}\s*=\s*await\s+specification\.(?:${CONSTRUCTORS})\s*\(`,
        'gu',
    );
    for (const match of text.matchAll(decl)) {
        for (const raw of (match.groups?.names ?? '').split(',')) {
            const key = (raw.split(':')[0] ?? '').trim();
            if (key.length > 0 && !NON_RUNNER_BINDINGS.has(key)) {
                names.add(key);
            }
        }
    }
    return names;
}

function leadingCallee(value: string): null | string {
    const match = /^(?<callee>[A-Za-z_$][\w$]*)\s*\(/u.exec(value.trim());
    return match === null ? match : (match.groups?.callee ?? null);
}

function sqlDatabaseCount(text: string): null | number {
    const keyword = /\bservices\s*:/u.exec(text);
    if (keyword === null) {
        return null;
    }
    const braceIndex = text.indexOf('{', keyword.index + keyword[0].length);
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
            return null;
        }
        const value = pair.slice(colon + 1).trim();
        const callee = leadingCallee(value);
        if (callee === null) {
            return null;
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

function resolveRelativeImport(fromFile: string, specifier: string): string | undefined {
    if (!specifier.startsWith('.')) {
        return undefined;
    }
    return resolve(dirname(fromFile), specifier).replace(/\.js$/u, '.ts');
}

type ImportedBinding = { local: string; name: string; source: string };

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

/** The runners are inferred from the `docker:` option of the imported spec files, where the oxlint rule needs them spelled by hand. */
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
        // The `await using` form matches group 1 and is exempt.
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
        // Enforced only when exactly one imported spec applies: mixed database configurations are ambiguous.
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

const DISK_CALL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

/** An entry is referenced by the path that reaches it, never by a literal that merely spells its name. */
type References = { paths: Set<string>; patterns: LiteralPattern[] };

/** A source's other literals are read word by word from the file and from the project root too: a path may be bound to a name first, or run by a process service (`node specs/shared/fixtures/app/server.mjs`). */
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

function isConventionalSubdir(path: string): boolean {
    if (!isDir(path)) {
        return false;
    }
    // A real ground folder holds leaf fixtures, never a test nor a nested ground folder.
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

        // A domain owns 1..n `<aspect>.test.ts` (C1'): its ground is dead only when it carries no test at all.
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

function checkPoolFixtures(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const pool of findPools(rootDir)) {
        const specsRoot = specsRootOfPool(pool);
        // A reference made from inside the pool is left out: a dead entry cannot vouch for another.
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

type FixtureReference = {
    column: number;
    file: string;
    key?: string;
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

const FIXTURE_CALL =
    /\.fixture\(\s*(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

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

/** A template is read whole as a string: a call inside `${…}` is out of reach. */
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

function listReferrers(specsRoot: string, pool: string): string[] {
    return listFiles(
        specsRoot,
        (path) => path.endsWith('.ts') || path.endsWith(SPEC_EXTENSION),
    ).filter((file) => !file.startsWith(`${pool}/`) && !file.startsWith(`${pool}\\`));
}

function poolEntryOf(file: string, path: string, pool: string): string | undefined {
    const inPool = relative(pool, resolve(dirname(file), path));
    if (inPool === '' || inPool.startsWith('..') || isAbsolute(inPool)) {
        return undefined;
    }
    const entry = inPool.split(sep)[0] ?? '';
    return entry.length > 0 ? entry : undefined;
}

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

/** `undefined` when the leaves only meet above any leaf, where the pool is their common level. */
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

type MisplacedPoolFixture = {
    entry: string;
    leaf: string;
    pool: string;
    referrers: string[];
};

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
    }
    return named;
}

/** Two documents of one leaf count once: the unit is the folder. An entry nothing names is C9's case, not this one. */
function misplacedPoolFixtures(rootDir: string): MisplacedPoolFixture[] {
    const misplaced: MisplacedPoolFixture[] = [];
    const named = new Map<string, string[]>();
    for (const pool of findPools(rootDir)) {
        const specsRoot = specsRootOfPool(pool);
        const member = dirname(specsRoot);
        const paths = named.get(member) ?? pathsModuleTestsName(member);
        named.set(member, paths);
        const readOutside = new Set(
            paths.flatMap((path) => poolEntryOf(dirname(path), path, pool) ?? []),
        );
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

/** A pool the move empties goes with it, and the shared folder when it was the last. */
export function fixPoolFixtures(rootDir: string): string[] {
    const moved: string[] = [];
    for (const { entry, leaf, pool, referrers } of misplacedPoolFixtures(rootDir)) {
        const role = basename(pool);
        const destination = join(leaf, role, entry);
        if (existsSync(destination)) {
            continue;
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

/** A tree compares by the listing git keeps, so an ignored file is no difference. */
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

function removeIfEmpty(folder: string): void {
    if (existsSync(folder) && readdirSync(folder).length === 0) {
        rmSync(folder, { recursive: true });
    }
}

type CopiedGround = {
    /** Sorted: the first is the one a fix moves. */
    copies: string[];
    fingerprint: string;
    /** `null` when the copies go by several names: none of them is the one to keep. */
    target: null | string;
};

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

/** A warning, since two leaves may mean to diverge; `--fix` acts only when the copies share one name, the only name a fix could keep. */
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

function pathFrom(from: string, to: string): string {
    const rest = relative(from, to).split(sep).join('/');
    return rest.startsWith('.') ? rest : `./${rest}`;
}

type Move = { copy: string; target: string };

function repointed(from: string, path: string, { copy, target }: Move): string | undefined {
    const reached = resolve(from, path);
    if (reached !== copy && !isWithin(copy, reached)) {
        return undefined;
    }
    const moved = pathFrom(from, join(target, relative(copy, reached)));
    return path.endsWith('/') && !moved.endsWith('/') ? `${moved}/` : moved;
}

function relativeLiterals(text: string): { end: number; start: number; value: string }[] {
    const scanned = blankComments(text);
    return literalSpans(scanned).flatMap(({ end, start }) => {
        const value = scanned.slice(start + 1, end - 1);
        const quoted = `'"\``.includes(scanned[start] ?? '') && !value.includes('${');
        return quoted && isRelativePath(value) ? [{ end, start, value }] : [];
    });
}

export function repointSource(file: string, move: (path: string) => string | undefined): string {
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

/** An entry the target already holds byte for byte deletes every copy; one holding something else, or copies of several names, are the author's call and nothing moves. */
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

function isLeaf(directory: string): boolean {
    return treeEntries(directory).some(
        (entry) =>
            entry.isFile() && (isTestFileName(entry.name) || entry.name.endsWith(SPEC_EXTENSION)),
    );
}

/** `map/pois/` holds the ground `map/pois/detail/` shares with it. */
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

function rootGroundOf(specsRoot: string): string[] {
    return GROUND_DIRS.map((role) => join(specsRoot, role)).filter((folder) => isDir(folder));
}

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

/** An entry the shared folder already holds by that name stays, for the author. */
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

/** Inside a git work tree a path names only what git keeps: an ignored target exists on this workstation and on no checkout. */
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

/** A lone piece counts only when spelled `./` or `../`: a bare one (`resolve(import.meta.dirname, '../expected')`) is as often an output folder as a path read; a piece opening on `/` restarts the path. */
function anchoredPaths(
    file: string,
): { column: number; line: number; named: string; target: string }[] {
    const text = readText(file);
    const program = parseProgram(file, text);
    if (!isNode(program)) {
        return [];
    }
    const found: { column: number; line: number; named: string; target: string }[] = [];
    visitProgram(
        program,
        literalPathVisitor(({ node, pieces }) => {
            const [only] = pieces;
            const lone = pieces.length === 1 && !isRelativePath(only ?? '');
            if (lone || pieces.some((piece) => isAbsolute(piece))) {
                return;
            }
            const at = nodeStart(node);
            found.push({
                column: columnAt(text, at),
                line: lineAt(text, at),
                named: pieces.map((piece) => `'${piece}'`).join(', '),
                target: resolve(dirname(file), ...pieces),
            });
        }),
    );
    return found;
}

export function diskTargetFindings(file: string, rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const suppressed = file.endsWith(SPEC_EXTENSION)
        ? new Set<number>()
        : suppressedLines(readText(file), 'c8');
    if (!file.endsWith(SPEC_EXTENSION)) {
        for (const { column, line, named, target } of anchoredPaths(file)) {
            if (treeKind(target) !== undefined || suppressed.has(line)) {
                continue;
            }
            violations.push({
                column,
                file: relative(rootDir, file),
                line,
                ...missingTarget(named, relative(rootDir, target), existsSync(target)),
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

export function checkDiskTargetsExist(rootDir: string): TokenViolation[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) =>
        listReferrers(specsRoot, join(specsRoot, SHARED_GROUND)).flatMap((file) =>
            diskTargetFindings(file, rootDir),
        ),
    );
}

function isWithin(directory: string, path: string): boolean {
    const rest = relative(directory, path);
    return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

const DIRECTIVE = /(?<lead>.*?)checker-disable(?:-next-line|-line)\s+(?<rest>.*)$/iu;

/** Only in a comment: the word inside a string is a test talking about suppressions. */
const COMMENT_LEAD = /(?:^|\s)(?:\/\/|\/\*|\*|#)\s*$/u;

const READABLE = /\.(?:[cm]?[jt]sx?|ya?ml|json|md|sql|http|txt)$/u;

function isReadableText(path: string): boolean {
    return READABLE.test(path);
}

function idOf(rest: string | undefined): string {
    const ids = rest?.trim() ?? '';
    return ids === '' ? '<id>' : ids;
}

const REASON = /--\s*\S/u;

/** The toolchain's `suppressions-reason` gate reads `oxlint-disable*` only, so this channel carries its own. */
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
