import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

import {
    GROUND_EXPECTED,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundName,
} from '../src/model/chain/ground.js';
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
import type { TokenViolation } from './checker.js';

/**
 * C28 — a ground file exists only if it is shared.
 *
 * A file a spec stands on is read at a distance: the reader of the test sees
 * `file('./expected/created.http')` and has to open another file to know what
 * the test expects. That is the price of sharing, and a file is worth it only
 * when several tests pay it together. So the checker counts the TESTS each
 * ground file is read by — a `test()`/`it()` whose body names it, a document —
 * and judges its level:
 *
 * - read by ONE test → it belongs in that test, written in place: a seed as
 *   ``sql`…` ``, a golden as the value `toMatch` compares, a request as its
 *   text or its body value. A directory tree, a binary file and a file longer
 *   than {@link INLINE_LINES} lines stay files; so does `fixtures/`, which is
 *   file state a program reads, never a value a test states;
 * - read by several tests of ONE leaf → beside them, in the leaf's own ground;
 *   a specs-root entry one leaf alone reaches is moved down (what C14 was);
 * - read from several leaves → the specs root's own ground, where C15 already
 *   holds a path that leaves its leaf, and C27 finds copies.
 *
 * A reference written outside every test — a `const` at the top of a file, a
 * helper — is read by as many tests as call it, which no scan can count: it
 * counts as shared, and the pass stays silent (precision over recall). Zero
 * references is C9's dead fixture.
 *
 * `--fix` inlines a single-use file where its one reference is a literal
 * `file()` handed straight to the verb that reads it, then deletes the file:
 * `.seed(file(…))` → ``.seed(sql`…`)``, `toMatch(file(…))` → the text (or, for
 * a json subject, the value) in place, `.post(path, file(…))` → the body value,
 * `.request(file(…))` → the request's text. Any other shape is reported and
 * left to the author.
 */

/** The longest file a test is asked to hold in place — the owner's cap. */
export const INLINE_LINES = 150;

/** The roles whose file has a form written in place. */
const INLINE_ROLES = new Set<string>([GROUND_SEEDS, GROUND_EXPECTED, GROUND_REQUESTS]);

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

/** Is this file one no test can hold in place — a binary, or longer than the cap? */
function staysAFile(path: string): boolean {
    const bytes = readFileSync(path);
    if (bytes.subarray(0, 8000).includes(0)) {
        return true;
    }
    return bytes.toString('utf8').split('\n').length > INLINE_LINES;
}

/** A single-use ground file, its first reference, and how many times its one test names it. */
type SingleUse = { reference: Reference; references: number; target: string };

/** The one reference of a file one test alone reads — `undefined` when several tests, or none, read it. */
function oneTestReads(named: readonly Reference[]): Reference | undefined {
    const [only] = named;
    const tests = new Set(named.map((reference) => reference.test));
    return only?.test !== undefined && tests.size === 1 ? only : undefined;
}

/** Can the file this reference names be written in place — a file, of an inline role, short and text? */
function inlinable(reference: Reference, target: string): boolean {
    return (
        reference.kind === 'file' &&
        INLINE_ROLES.has(roleOf(written(reference.file, target)) ?? '') &&
        treeKind(target) === 'file' &&
        !staysAFile(target)
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
    const role = roleOf(written(reference.file, reference.target));
    if (role === GROUND_SEEDS) {
        return '``sql`…` ``';
    }
    return role === GROUND_EXPECTED ? 'the value `toMatch` compares' : 'the request or its body';
}

/**
 * C28 — every ground file of the inline roles one test alone reads, reported
 * where the test names it; and every specs-root entry one leaf alone reaches,
 * reported where it sits.
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
        ...checkPoolFixtureSharing(rootDir).filter((finding) => !inlined.has(finding.file)),
    ];
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

/** The accessors whose subject is a json — its golden is a value in place. */
const JSON_SUBJECT = /\.(?:head|json|jsonLd|screen|value)\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

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
    if (/\.seed\s*\(\s*$/u.test(before)) {
        return `sql${block(content, indent)}`;
    }
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

/** The file's imports once it was inlined into: `sql` when it now seeds in place, no `file` when it reads no file. */
function importsOf(text: string, file: string): string {
    const seeded = /(?<![.\w])sql`/u.test(text) ? withEntryImport(text, file, 'sql') : text;
    const code = blankComments(seeded).replaceAll(QUOTED, "''");
    return /(?<![.\w])file\(/u.test(code) ? seeded : withoutEntryImport(seeded, 'file');
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
 * Apply C28: inline each single-use file into its one test and delete it, then
 * move every specs-root entry one leaf alone reaches beside that leaf. Returns
 * what changed, relative to `rootDir`.
 */
export function fixGroundSharing(rootDir: string): string[] {
    const done: string[] = [];
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
                `${relative(rootDir, target)} → ${relative(rootDir, file)}:${reference.line}`,
            );
        }
        if (inlined) {
            writeFileSync(file, importsOf(text, file));
        }
    }
    removeEmptied(emptied);
    forgetTree();
    done.push(...fixPoolFixtures(rootDir));
    return done;
}
