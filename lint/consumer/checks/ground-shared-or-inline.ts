import {
    blankComments,
    forgetTree,
    GROUND_EXPECTED,
    GROUND_REQUESTS,
    isGroundFolder,
    treeKind,
} from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

import { withEntryImport, withoutEntryImport } from '../../kit/checker/entry-import.js';
import { dedent } from '../../kit/project/dedent.js';
import { isRelativePath } from '../../kit/project/relative-path.js';
import { isInside, literalSpans, nameAround } from '../../kit/project/spec-values.js';
import type { Span } from '../../kit/project/spec-values.js';
import { closingOf, literalEnd } from '../../kit/project/subject.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { findSpecsRoots, listFiles } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';
import {
    checkGroundPlacement,
    fixGroundPlacement,
    pathsModuleTestsName,
} from './ground-shared-or-inline.placement.js';
import { checkInlineSeeds, fixInlineSeeds } from './ground-shared-or-inline.seeds.js';

/** A role absent here is never written in place. */
export const INLINE_CAPS: Readonly<Record<string, number>> = {
    [GROUND_EXPECTED]: 150,
    [GROUND_REQUESTS]: 30,
};

const DISK_LITERAL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>\s*\)/gu;

const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/u;

const TEST_CALL = /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(/gu;

type Reference = {
    column: number;
    end: number;
    file: string;
    kind: 'directory' | 'file';
    line: number;
    start: number;
    target: string;
    /** `undefined` for a reference outside every test. */
    test: string | undefined;
};

function stringEnd(text: string, start: number): number {
    const quote = text[start];
    let index = start + 1;
    while (index < text.length && text[index] !== quote) {
        index += text[index] === '\\' ? 2 : 1;
    }
    return index + 1;
}

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

function testSpans(text: string): { end: number; start: number }[] {
    return [...text.matchAll(TEST_CALL)].map((match) => ({
        end: closingParen(text, match.index + match[0].length - 1),
        start: match.index,
    }));
}

function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, index);
    return { column: index - before.lastIndexOf('\n'), line: before.split('\n').length };
}

/** `verb-reads-its-ground-folder`'s reading. */
function roleOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundFolder(segment));
}

function referencesIn(file: string): Reference[] {
    const text = blankComments(readFileSync(file, 'utf8'));
    // invariant: a module that is no test is read by every test importing it: what it names is shared.
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

function written(file: string, target: string): string {
    return relative(dirname(file), target).split('\\').join('/');
}

/** Its closing newline is no line of its own. */
export function valueLines(text: string): number {
    return text.replace(/\n$/u, '').split('\n').length;
}

/** A JSON file counts as the fixer writes its value. */
function inPlaceLines(path: string, content: string): number {
    const parsed = path.endsWith('.json') ? jsonOf(content) : undefined;
    return valueLines(parsed === undefined ? content : JSON.stringify(parsed, null, 4));
}

function staysAFile(path: string, cap: number): boolean {
    const bytes = readFileSync(path);
    if (bytes.subarray(0, 8000).includes(0)) {
        return true;
    }
    return inPlaceLines(path, bytes.toString('utf8')) > cap;
}

type SingleUse = { reference: Reference; references: number; target: string };

/** A reference outside every test (a top-level `const`, a helper) counts as shared: no scan can count its readers. */
function oneTestReads(named: readonly Reference[]): Reference | undefined {
    const [only] = named;
    const tests = new Set(named.map((reference) => reference.test));
    return only?.test !== undefined && tests.size === 1 ? only : undefined;
}

function inlinable(reference: Reference, target: string): boolean {
    const cap = INLINE_CAPS[roleOf(written(reference.file, target)) ?? ''];
    return (
        cap !== undefined &&
        reference.kind === 'file' &&
        treeKind(target) === 'file' &&
        !staysAFile(target, cap)
    );
}

function within(directory: string, path: string): boolean {
    const rest = relative(directory, path);
    return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

function singleUseFiles(rootDir: string): SingleUse[] {
    const roots = findSpecsRoots(rootDir);
    const references = roots.flatMap((root) =>
        listFiles(root, (path) => /\.[cm]?[jt]sx?$/u.test(path)).flatMap((file) =>
            referencesIn(file),
        ),
    );
    const namedOutside = roots.flatMap((root) =>
        pathsModuleTestsName(dirname(root)).filter((path) => within(root, path)),
    );
    const byTarget = new Map<string, Reference[]>();
    for (const reference of references) {
        byTarget.set(reference.target, [...(byTarget.get(reference.target) ?? []), reference]);
    }
    const single: SingleUse[] = [];
    for (const [target, named] of byTarget) {
        const only = oneTestReads(named);
        const shared = namedOutside.some((path) => path === target || within(path, target));
        if (only !== undefined && !shared && inlinable(only, target)) {
            single.push({ reference: only, references: named.length, target });
        }
    }
    return single.filter(
        ({ reference }) =>
            !suppressedLines(readFileSync(reference.file, 'utf8'), 'ground-shared-or-inline').has(
                reference.line,
            ),
    );
}

function inPlaceForm(reference: Reference): string {
    return roleOf(written(reference.file, reference.target)) === GROUND_EXPECTED
        ? 'the value `toMatch` compares'
        : 'the request or its body';
}

type Oversized = {
    column: number;
    end: number;
    /** `undefined` when no file form holds it. */
    extension: string | undefined;
    file: string;
    line: number;
    lines: number;
    name: string;
    role: string;
    start: number;
    /** A string has no golden, so the value stays in place. */
    subject: string | undefined;
    text: string | undefined;
};

const VALUE_CALL = /\.(?<verb>post|put|request|toMatch)\s*\(/gu;

const VALUE_START = /^[`'"{[]/u;

const JSON_SUBJECT = /\.(?:head|json|jsonLd|screen|value)\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

const STRING_SUBJECT = /\.(?:text|raw)\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

/** vitest's own `toMatch` takes no file: its long value is reported, never written to one. */
const PLAIN_SUBJECT =
    /expect\s*\(\s*(?<subject>[A-Za-z_$][\w$]*|'[^'\n]*'|"[^"\n]*")\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

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

type Candidate = Span & { before: string; role: string; source: string; verb: string };

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

function oversizedIn(file: string): Oversized[] {
    const source = readFileSync(file, 'utf8');
    const text = blankComments(source);
    const literals = literalSpans(text);
    const suppressed = suppressedLines(source, 'ground-shared-or-inline');
    return [...text.matchAll(VALUE_CALL)].flatMap((call) => {
        const candidate = candidateAt(text, call, literals);
        if (candidate === undefined) {
            return [];
        }
        const subject =
            candidate.verb === 'toMatch'
                ? PLAIN_SUBJECT.exec(candidate.before)?.groups?.subject
                : undefined;
        const form =
            subject === undefined
                ? fileForm(candidate.verb, candidate.before, literalValue(candidate.source))
                : { extension: undefined, text: undefined };
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
                subject,
                text: form.extension === undefined ? undefined : form.text,
            },
        ];
    });
}

function oversizedValues(rootDir: string): Oversized[] {
    return findSpecsRoots(rootDir).flatMap((root) =>
        listFiles(root, (path) => TEST_FILE.test(path)).flatMap((file) => oversizedIn(file)),
    );
}

/** Its own bytes are reused; another's are skipped past with a suffix. */
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

function capFix(oversized: Oversized, target: string): string {
    if (oversized.subject !== undefined) {
        return `a string has no golden: wrap it — \`expect(text(${oversized.subject})).toMatch(file('./${oversized.role}/${oversized.name}.txt'))\` — or compare the result it came from to its file; by hand: the fixer never writes a string's comparison to a file`;
    }
    return oversized.text === undefined
        ? `move it to a file under ./${oversized.role}/ and name it with file() — by hand: the fixer reads a string, a template or a JSON value only`
        : `move it to ${target} and name it with file('${target}') — \`typescript fix\` moves it`;
}

function capFinding(rootDir: string, oversized: Oversized): Spotted {
    const kind = oversized.role === GROUND_EXPECTED ? 'an expectation' : 'a request';
    const target = `./${oversized.role}/${oversized.name}${oversized.extension ?? ''}`;
    return {
        column: oversized.column,
        path: relative(rootDir, oversized.file),
        fix: capFix(oversized, target),
        found: `${kind} of ${oversized.lines} lines written in the test, past the ${oversized.role}/ cap of ${INLINE_CAPS[oversized.role] ?? 0}`,
        line: oversized.line,
        rule: 'ground-shared-or-inline',
    };
}

export function checkGroundSharedOrInline(rootDir: string): Spotted[] {
    const single = singleUseFiles(rootDir).map(({ reference, target }) => ({
        column: reference.column,
        path: relative(rootDir, reference.file),
        line: reference.line,
        fix: `write it here, ${inPlaceForm(reference)}, and delete the file — \`typescript fix\` inlines it`,
        found: `${relative(rootDir, target)}, read by this test alone`,
        rule: 'ground-shared-or-inline' as const,
    }));
    const inlined = new Set(singleUseFiles(rootDir).map(({ target }) => relative(rootDir, target)));
    return [
        ...single,
        ...oversizedValues(rootDir).map((oversized) => capFinding(rootDir, oversized)),
        ...checkInlineSeeds(rootDir),
        ...checkGroundPlacement(rootDir).filter((finding) => !inlined.has(finding.path)),
    ];
}

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

function escapeTemplate(text: string): string {
    return text
        .replaceAll('\\', String.raw`\\`)
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');
}

function block(text: string, indent: string): string {
    const lines = text.split('\n');
    if (lines.length === 1) {
        return `\`${escapeTemplate(text)}\``;
    }
    const inner = `${indent}    `;
    const last = lines.pop() ?? '';
    const body = lines.map((line) => (line === '' ? '' : `${inner}${line}`)).join('\n');
    const closing = last === '' ? indent : `${inner}${last}`;
    // invariant: the literal is read back through the runtime's own dedent: a candidate that does not come back unchanged is written as one quoted line.
    return dedent(`\n${body}\n${closing}`) === text
        ? `\`\n${escapeTemplate(body)}\n${escapeTemplate(closing)}\``
        : JSON.stringify(text);
}

function value(parsed: unknown, indent: string): string {
    return (JSON.stringify(parsed, null, 4) ?? 'null').split('\n').join(`\n${indent}`);
}

function jsonOf(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return undefined;
    }
}

/** `undefined` for a shape the fixer does not rewrite. */
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

const QUOTED = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gu;

function importsOf(text: string): string {
    const code = blankComments(text).replaceAll(QUOTED, "''");
    return /(?<![.\w])file\(/u.test(code) ? text : withoutEntryImport(text, 'file');
}

function removeEmptied(folders: Set<string>): void {
    for (const folder of [...folders].toSorted((a, b) => b.length - a.length)) {
        try {
            if (readdirSync(folder).length === 0) {
                rmSync(folder, { recursive: true });
            }
        } catch {
            // invariant: already gone with a deeper one.
        }
    }
}

export function fixGroundSharedOrInline(rootDir: string): string[] {
    const done = [...fixInlineSeeds(rootDir), ...fixOversizedValues(rootDir)].map(
        (change) => `wrote ${change}`,
    );
    const emptied = new Set<string>();
    const byFile = new Map<string, SingleUse[]>();
    // invariant: a file its one test names twice is the author's to write in place, once.
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
    done.push(...fixGroundPlacement(rootDir).map((move) => `moved ${move}`));
    return done;
}
