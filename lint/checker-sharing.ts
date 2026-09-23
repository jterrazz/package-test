import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

import { GROUND_EXPECTED, GROUND_REQUESTS, isGroundName } from '../src/model/chain/ground.js';
import { isRelativePath } from '../src/model/chain/spec-path.js';
import { dedent } from '../src/model/matching/dedent.js';
import { forgetTree, treeKind } from '../src/seams/git/tree.js';
import {
    blankComments,
    checkPoolFixtureSharing,
    findSpecsRoots,
    fixPoolFixtures,
    listFiles,
    suppressedLines,
} from './checker-crossfile.js';
import { withEntryImport, withoutEntryImport } from './checker-migration.js';
import { checkInlineSeeds, fixInlineSeeds } from './checker-sql-seeds.js';
import type { TokenViolation } from './checker.js';
import { isInside, literalSpans, nameAround } from './spec-values.js';
import type { Span } from './spec-values.js';
import { closingOf, literalEnd, withoutComments } from './subject.js';

/**
 * C28 — a ground file exists only if it is shared, and a value only as long
 * as a test can hold it.
 *
 * A file a spec stands on is read at a distance: the reader of the test sees
 * `file('./expected/created.http')` and has to open another file to know what
 * the test expects. That is the price of sharing, and a file is worth it only
 * when several tests pay it together. So the checker counts the TESTS each
 * ground file is read by — a `test()`/`it()` whose body names it, a document —
 * and judges its level:
 *
 * - read by ONE test → it belongs in that test, written in place: a golden as
 *   the value `toMatch` compares, a request as its text or its body value. A
 *   directory tree, a binary file and a file longer than its role's cap
 *   ({@link INLINE_CAPS}) stay files; so does `fixtures/`, which is file state
 *   a program reads, and `seeds/`: SQL is never written in a test, so a seed
 *   one test reads lives beside it, in `./seeds/`;
 * - read by several tests of ONE leaf → beside them, in the leaf's own ground;
 *   a specs-root entry one leaf alone reaches is moved down (what C14 was);
 * - read from several leaves → the specs root's own ground, where C15 already
 *   holds a path that leaves its leaf, and C27 finds copies.
 *
 * The caps hold the other way too: a request written in the test longer than
 * the requests cap, or an expectation longer than the expected cap, is a file
 * even when one test reads it.
 *
 * A reference written outside every test — a `const` at the top of a file, a
 * helper — is read by as many tests as call it, which no scan can count: it
 * counts as shared, and the pass stays silent (precision over recall). Zero
 * references is C9's dead fixture.
 *
 * `--fix` inlines a single-use file where its one reference is a literal
 * `file()` handed straight to the verb that reads it, then deletes the file:
 * `toMatch(file(…))` → the text (or, for a json subject, the value) in place,
 * `.post(path, file(…))` → the body value, `.request(file(…))` → the
 * request's text. It writes a value past its cap to a file beside the test,
 * named from the test's title, and names it with `file()`. Any other shape is
 * reported and left to the author.
 */

/** The most lines a value of each role holds in place — the owner's caps; a role absent here is never written in place. */
export const INLINE_CAPS: Readonly<Record<string, number>> = {
    [GROUND_EXPECTED]: 150,
    [GROUND_REQUESTS]: 30,
};

/** A `file()`/`directory()` literal, and the verb or matcher it is handed to. */
const DISK_LITERAL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>\s*\)/gu;

/** A file whose calls are tests. */
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/u;

/** The start of a test's call: `test(`, `it(`, and their modifiers (`test.each(…)(`). */
const TEST_CALL = /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(/gu;

/** One reference to a ground file: where it is written, and the test it is written in. */
type Reference = {
    column: number;
    /** The source offset of the `file(`/`directory(` call, and past its closing paren. */
    end: number;
    file: string;
    kind: 'directory' | 'file';
    line: number;
    start: number;
    /** The ground file it resolves to. */
    target: string;
    /** The test it counts for — `undefined` for a reference outside every test. */
    test: string | undefined;
};

/** Past the string literal opening at `start`, a template's holes skipped by depth. */
function stringEnd(text: string, start: number): number {
    const quote = text[start];
    let index = start + 1;
    while (index < text.length && text[index] !== quote) {
        index += text[index] === '\\' ? 2 : 1;
    }
    return index + 1;
}

/** Past the parenthesis closing the one opening at `open`, strings skipped. */
function closingParen(text: string, open: number): number {
    let depth = 0;
    let index = open;
    while (index < text.length) {
        const character = text[index] ?? '';
        if (character === '"' || character === "'" || character === '`') {
            index = stringEnd(text, index);
            continue;
        }
        depth += character === '(' ? 1 : character === ')' ? -1 : 0;
        index += 1;
        if (depth === 0) {
            return index;
        }
    }
    return text.length;
}

/** Each test of a source, as the span of its call. */
function testSpans(text: string): { end: number; start: number }[] {
    return [...text.matchAll(TEST_CALL)].map((match) => ({
        end: closingParen(text, match.index + match[0].length - 1),
        start: match.index,
    }));
}

/** The 1-based line and column of an offset. */
function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, index);
    return { column: index - before.lastIndexOf('\n'), line: before.split('\n').length };
}

/** The first ground folder a path passes through, if any — C24's reading. */
function roleOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundName(segment));
}

/** Every literal reference a test file writes to a ground file, each with the test it sits in. */
function referencesIn(file: string): Reference[] {
    const text = blankComments(readFileSync(file, 'utf8'));
    // A module that is no test — a specification, a helper — is read by every
    // test that imports it: what it names counts as shared.
    const spans = TEST_FILE.test(file) ? testSpans(text) : [];
    const references: Reference[] = [];
    for (const match of text.matchAll(DISK_LITERAL)) {
        const path = match.groups?.path ?? '';
        if (!isRelativePath(path) || path.includes('${') || roleOf(path) === undefined) {
            continue;
        }
        const inside = spans.findLast((span) => span.start < match.index && match.index < span.end);
        references.push({
            ...positionOf(text, match.index),
            end: match.index + match[0].length,
            file,
            kind: match.groups?.kind === 'directory' ? 'directory' : 'file',
            start: match.index,
            target: resolve(dirname(file), path),
            test: inside === undefined ? undefined : `${file}:${inside.start}`,
        });
    }
    return references;
}

/** The path from a test to its target, as the test spells it. */
function written(file: string, target: string): string {
    return relative(dirname(file), target).split('\\').join('/');
}

/** The lines a value takes, its closing newline no line of its own. */
export function valueLines(text: string): number {
    return text.replace(/\n$/u, '').split('\n').length;
}

/** The lines a file's content takes in place: a JSON file as the fixer writes its value, anything else as it stands. */
function inPlaceLines(path: string, content: string): number {
    const parsed = path.endsWith('.json') ? jsonOf(content) : undefined;
    return valueLines(parsed === undefined ? content : JSON.stringify(parsed, null, 4));
}

/** Is this file one no test can hold in place — a binary, or longer than its role's cap? */
function staysAFile(path: string, cap: number): boolean {
    const bytes = readFileSync(path);
    if (bytes.subarray(0, 8000).includes(0)) {
        return true;
    }
    return inPlaceLines(path, bytes.toString('utf8')) > cap;
}

/** A single-use ground file, its first reference, and how many times its one test names it. */
type SingleUse = { reference: Reference; references: number; target: string };

/** The one reference of a file one test alone reads — `undefined` when several tests, or none, read it. */
function oneTestReads(named: readonly Reference[]): Reference | undefined {
    const [only] = named;
    const tests = new Set(named.map((reference) => reference.test));
    return only?.test !== undefined && tests.size === 1 ? only : undefined;
}

/** Can the file this reference names be written in place — a file, of an inline role, text within its cap? */
function inlinable(reference: Reference, target: string): boolean {
    const cap = INLINE_CAPS[roleOf(written(reference.file, target)) ?? ''];
    return (
        cap !== undefined &&
        reference.kind === 'file' &&
        treeKind(target) === 'file' &&
        !staysAFile(target, cap)
    );
}

/** Every ground file of the inline roles one test alone reads, under `rootDir`. */
function singleUseFiles(rootDir: string): SingleUse[] {
    const references = findSpecsRoots(rootDir).flatMap((root) =>
        listFiles(root, (path) => /\.[cm]?[jt]sx?$/u.test(path)).flatMap((file) =>
            referencesIn(file),
        ),
    );
    const byTarget = new Map<string, Reference[]>();
    for (const reference of references) {
        byTarget.set(reference.target, [...(byTarget.get(reference.target) ?? []), reference]);
    }
    const single: SingleUse[] = [];
    for (const [target, named] of byTarget) {
        const only = oneTestReads(named);
        if (only !== undefined && inlinable(only, target)) {
            single.push({ reference: only, references: named.length, target });
        }
    }
    return single.filter(
        ({ reference }) =>
            !suppressedLines(readFileSync(reference.file, 'utf8'), 'c28').has(reference.line),
    );
}

/** The form a single-use file takes in place, by the role its reference reads. */
function inPlaceForm(reference: Reference): string {
    return roleOf(written(reference.file, reference.target)) === GROUND_EXPECTED
        ? 'the value `toMatch` compares'
        : 'the request or its body';
}

// ── A value past its cap ──

/** A value written in a test, past the cap of the role its file would take. */
type Oversized = {
    column: number;
    /** The argument's span in the source. */
    end: number;
    /** The file it goes to, beside the test — `undefined` when no file form holds it. */
    extension: string | undefined;
    file: string;
    line: number;
    lines: number;
    name: string;
    role: string;
    start: number;
    /** What the file holds — `undefined` when the value is no literal the fixer can read. */
    text: string | undefined;
};

/** A call whose argument is a value of a ground role: a body, a request, an expectation. */
const VALUE_CALL = /\.(?<verb>post|put|request|toMatch)\s*\(/gu;

/** The first characters of a value written in place: a string, a template, an object, a list. */
const VALUE_START = /^[`'"{[]/u;

/** The accessors whose subject is a json — its golden is a value in place. */
const JSON_SUBJECT = /\.(?:head|json|jsonLd|screen|value)\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

/** A string subject — vitest's own `toMatch`, no whole result. */
const STRING_SUBJECT = /\.(?:text|raw)\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

/** The arguments of the call opening at `open`, each by its trimmed span. */
function argumentSpans(text: string, open: number): Span[] {
    const close = closingOf(text, open);
    const spans: Span[] = [];
    let start = open + 1;
    for (let index = open + 1; index <= close;) {
        const past = literalEnd(text, index);
        if (past !== index) {
            index = past;
            continue;
        }
        const character = text[index] ?? '';
        if (character === '(' || character === '[' || character === '{') {
            index = closingOf(text, index) + 1;
            continue;
        }
        if (character === ',' || index === close) {
            const raw = text.slice(start, index);
            const lead = raw.length - raw.trimStart().length;
            if (raw.trim() !== '') {
                spans.push({ end: start + raw.trimEnd().length, start: start + lead });
            }
            start = index + 1;
        }
        index += 1;
    }
    return spans;
}

/** The value a literal states, read as the runtime reads it — `undefined` when it is no literal. */
function literalValue(source: string): unknown {
    if (/\$\{/u.test(source)) {
        return undefined;
    }
    try {
        return runInNewContext(`(${source})`, Object.create(null) as object, { timeout: 1000 });
    } catch {
        return undefined;
    }
}

/** The text a value's file holds, and the extension it takes, by the verb that reads it. */
function fileForm(
    verb: string,
    before: string,
    stated: unknown,
): { extension: string | undefined; text: string | undefined } {
    if (typeof stated === 'string') {
        if (verb === 'post' || verb === 'put') {
            return { extension: '.txt', text: stated };
        }
        const http =
            verb === 'request' || /\.response\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u.test(before);
        return { extension: http ? '.http' : '.txt', text: dedent(stated) };
    }
    if (stated === undefined || typeof stated !== 'object') {
        return { extension: undefined, text: undefined };
    }
    const json = `${JSON.stringify(stated, null, 4)}\n`;
    return verb === 'toMatch' && !JSON_SUBJECT.test(before)
        ? { extension: undefined, text: undefined }
        : { extension: '.json', text: json };
}

/** A call's value argument, when it is written in place: its span, its role, and the verb before it. */
type Candidate = Span & { before: string; role: string; source: string; verb: string };

/** The value a `VALUE_CALL` match hands its verb, if it is one written in place. */
function candidateAt(
    text: string,
    call: RegExpExecArray,
    literals: readonly Span[],
): Candidate | undefined {
    const verb = call.groups?.verb ?? '';
    const open = call.index + call[0].length - 1;
    const before = text.slice(0, open + 1);
    if (isInside(literals, call.index) || (verb === 'toMatch' && STRING_SUBJECT.test(before))) {
        return undefined;
    }
    const argument = argumentSpans(text, open)[verb === 'post' || verb === 'put' ? 1 : 0];
    const source = argument === undefined ? '' : text.slice(argument.start, argument.end);
    if (argument === undefined || !VALUE_START.test(source)) {
        return undefined;
    }
    const role = verb === 'toMatch' ? GROUND_EXPECTED : GROUND_REQUESTS;
    return { ...argument, before, role, source, verb };
}

/** Every value a test file writes in place past its role's cap. */
function oversizedIn(file: string): Oversized[] {
    const source = readFileSync(file, 'utf8');
    const text = withoutComments(source);
    const literals = literalSpans(text);
    const suppressed = suppressedLines(source, 'c28');
    return [...text.matchAll(VALUE_CALL)].flatMap((call) => {
        const candidate = candidateAt(text, call, literals);
        if (candidate === undefined) {
            return [];
        }
        const form = fileForm(candidate.verb, candidate.before, literalValue(candidate.source));
        const lines = valueLines(form.text ?? candidate.source);
        const position = text.slice(0, candidate.start);
        const line = position.split('\n').length;
        if (lines <= (INLINE_CAPS[candidate.role] ?? lines) || suppressed.has(line)) {
            return [];
        }
        return [
            {
                column: candidate.start - position.lastIndexOf('\n'),
                end: candidate.end,
                extension: form.extension,
                file,
                line,
                lines,
                name: nameAround(text, candidate.start, candidate.role),
                role: candidate.role,
                start: candidate.start,
                text: form.extension === undefined ? undefined : form.text,
            },
        ];
    });
}

/** Every value the specs trees under `rootDir` write in place past its role's cap. */
function oversizedValues(rootDir: string): Oversized[] {
    return findSpecsRoots(rootDir).flatMap((root) =>
        listFiles(root, (path) => TEST_FILE.test(path)).flatMap((file) => oversizedIn(file)),
    );
}

/** The path a value's file takes beside `file`: its own bytes reused, another's skipped past with a suffix. */
function freePath(file: string, oversized: Oversized): string {
    const folder = join(dirname(file), oversized.role);
    for (let suffix = 1; ; suffix += 1) {
        const path = join(
            folder,
            `${oversized.name}${suffix === 1 ? '' : `-${suffix}`}${oversized.extension ?? ''}`,
        );
        if (!existsSync(path) || readFileSync(path, 'utf8') === oversized.text) {
            return path;
        }
    }
}

/** What C28 tells the author of a value past its cap. */
function capFinding(rootDir: string, oversized: Oversized): TokenViolation {
    const kind = oversized.role === GROUND_EXPECTED ? 'an expectation' : 'a request';
    const target = `./${oversized.role}/${oversized.name}${oversized.extension ?? ''}`;
    return {
        column: oversized.column,
        file: relative(rootDir, oversized.file),
        fix:
            oversized.text === undefined
                ? `move it to a file under ./${oversized.role}/ and name it with file() — by hand: the fixer reads a string, a template or a JSON value only`
                : `move it to ${target} and name it with file('${target}') — \`make fix\` moves it`,
        found: `${kind} of ${oversized.lines} lines written in the test, past the ${oversized.role}/ cap of ${INLINE_CAPS[oversized.role] ?? 0}`,
        line: oversized.line,
        rule: 'c28-ground-shared-or-inline',
        severity: 'error',
    };
}

/**
 * C28 — every ground file of the inline roles one test alone reads, reported
 * where the test names it; every value past its role's cap and every SQL
 * written in a test, reported where it is written; and every specs-root entry
 * one leaf alone reaches, reported where it sits.
 */
export function checkGroundSharing(rootDir: string): TokenViolation[] {
    const single = singleUseFiles(rootDir).map(({ reference, target }) => ({
        column: reference.column,
        file: relative(rootDir, reference.file),
        line: reference.line,
        fix: `write it here, ${inPlaceForm(reference)}, and delete the file — \`make fix\` inlines it`,
        found: `${relative(rootDir, target)}, read by this test alone`,
        rule: 'c28-ground-shared-or-inline' as const,
        severity: 'error' as const,
    }));
    const inlined = new Set(singleUseFiles(rootDir).map(({ target }) => relative(rootDir, target)));
    return [
        ...single,
        ...oversizedValues(rootDir).map((oversized) => capFinding(rootDir, oversized)),
        ...checkInlineSeeds(rootDir),
        ...checkPoolFixtureSharing(rootDir).filter((finding) => !inlined.has(finding.file)),
    ];
}

/** Write every value past its cap to its file beside the test, named with `file()` where it stood. */
function fixOversizedValues(rootDir: string): string[] {
    const done: string[] = [];
    const byFile = Map.groupBy(
        oversizedValues(rootDir).filter((oversized) => oversized.text !== undefined),
        (oversized) => oversized.file,
    );
    for (const [file, values] of byFile) {
        let text = readFileSync(file, 'utf8');
        for (const oversized of values.toSorted((a, b) => b.start - a.start)) {
            const path = freePath(file, oversized);
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, oversized.text ?? '');
            const named = `./${relative(dirname(file), path).split('\\').join('/')}`;
            text = `${text.slice(0, oversized.start)}file('${named}')${text.slice(oversized.end)}`;
            done.push(`${relative(rootDir, file)}:${oversized.line} → ${relative(rootDir, path)}`);
        }
        writeFileSync(file, withEntryImport(text, file, 'file'));
    }
    forgetTree();
    return done;
}

// ── --fix ──

/** A template literal's body: every character it would read as syntax, escaped. */
function escapeTemplate(text: string): string {
    return text
        .replaceAll('\\', String.raw`\\`)
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');
}

/** A text as a template literal: one line alone, or a block indented one level deeper than `indent`. */
function block(text: string, indent: string): string {
    const lines = text.split('\n');
    if (lines.length === 1) {
        return `\`${escapeTemplate(text)}\``;
    }
    const inner = `${indent}    `;
    const last = lines.pop() ?? '';
    const body = lines.map((line) => (line === '' ? '' : `${inner}${line}`)).join('\n');
    const closing = last === '' ? indent : `${inner}${last}`;
    // The literal is read back by the runtime's own dedent, so the fixer
    // proves the round trip instead of guessing at the shapes that lose it
    // (text already indented, a last line of spaces alone): a candidate that
    // does not come back unchanged is written as one quoted line instead.
    return dedent(`\n${body}\n${closing}`) === text
        ? `\`\n${escapeTemplate(body)}\n${escapeTemplate(closing)}\``
        : JSON.stringify(text);
}

/** A JSON value as code, each line after the first indented with the call. */
function value(parsed: unknown, indent: string): string {
    return (JSON.stringify(parsed, null, 4) ?? 'null').split('\n').join(`\n${indent}`);
}

/** The JSON a text holds, or `undefined` when it holds none. */
function jsonOf(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return undefined;
    }
}

/**
 * What replaces the `file(…)` call in place, read from what it is handed to —
 * or `undefined` when the shape is one the fixer does not rewrite.
 */
function replacementOf(
    before: string,
    content: string,
    target: string,
    indent: string,
): string | undefined {
    const extension = extname(target);
    if (/\.request\s*\(\s*$/u.test(before)) {
        return block(content, indent);
    }
    if (/\.(?:post|put)\s*\([^()]*,\s*$/u.test(before)) {
        const parsed = extension === '.json' ? jsonOf(content) : undefined;
        return parsed === undefined ? JSON.stringify(content) : value(parsed, indent);
    }
    if (!/\.toMatch\s*\(\s*$/u.test(before)) {
        return undefined;
    }
    if (JSON_SUBJECT.test(before)) {
        const parsed = jsonOf(content);
        return parsed === undefined ? undefined : value(parsed, indent);
    }
    return extension === '.json' && !/\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u.test(before)
        ? undefined
        : block(content, indent);
}

/** A string literal, its content dropped — what a scan for a call must not read. */
const QUOTED = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gu;

/** The file's imports once it was inlined into: no `file` when it reads no file. */
function importsOf(text: string): string {
    const code = blankComments(text).replaceAll(QUOTED, "''");
    return /(?<![.\w])file\(/u.test(code) ? text : withoutEntryImport(text, 'file');
}

/** Remove the leaf ground folders a fix emptied, deepest first. */
function removeEmptied(folders: Set<string>): void {
    for (const folder of [...folders].toSorted((a, b) => b.length - a.length)) {
        try {
            if (readdirSync(folder).length === 0) {
                rmSync(folder, { recursive: true });
            }
        } catch {
            // Already gone with a deeper one.
        }
    }
}

/**
 * Apply C28: write every SQL a test holds to a seed file beside it, and every
 * value past its cap to a file beside it; inline each single-use file into its
 * one test and delete it; then move every specs-root entry one leaf alone
 * reaches beside that leaf. Returns what changed, relative to `rootDir`, each
 * line opening on its verb — `wrote`, `inlined`, `moved`.
 */
export function fixGroundSharing(rootDir: string): string[] {
    const done = [...fixInlineSeeds(rootDir), ...fixOversizedValues(rootDir)].map(
        (change) => `wrote ${change}`,
    );
    const emptied = new Set<string>();
    const byFile = new Map<string, SingleUse[]>();
    // A file its one test names twice is written in place by the author, once, as a value both read.
    for (const use of singleUseFiles(rootDir).filter(({ references }) => references === 1)) {
        byFile.set(use.reference.file, [...(byFile.get(use.reference.file) ?? []), use]);
    }
    for (const [file, uses] of byFile) {
        let text = readFileSync(file, 'utf8');
        let inlined = false;
        for (const { reference, target } of uses.toSorted(
            (a, b) => b.reference.start - a.reference.start,
        )) {
            const lineStart = text.lastIndexOf('\n', reference.start - 1) + 1;
            const indent = /^[\t ]*/u.exec(text.slice(lineStart))?.[0] ?? '';
            const replacement = replacementOf(
                text.slice(0, reference.start),
                readFileSync(target, 'utf8'),
                target,
                indent,
            );
            if (replacement === undefined) {
                continue;
            }
            text = text.slice(0, reference.start) + replacement + text.slice(reference.end);
            rmSync(target);
            emptied.add(dirname(target));
            inlined = true;
            done.push(
                `inlined ${relative(rootDir, target)} → ${relative(rootDir, file)}:${reference.line}`,
            );
        }
        if (inlined) {
            writeFileSync(file, importsOf(text));
        }
    }
    removeEmptied(emptied);
    forgetTree();
    done.push(...fixPoolFixtures(rootDir).map((move) => `moved ${move}`));
    return done;
}
