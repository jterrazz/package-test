import {
    blankComments,
    forgetTree,
    GROUND_EXPECTED,
    isGroundFolder,
    treeKind,
} from '@jterrazz/typescript/rules';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { withoutEntryImport } from '../../kit/checker/entry-import.js';
import { isRelativePath } from '../../kit/project/relative-path.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { findSpecsRoots, listFiles } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';
import {
    INLINE_CAPS,
    jsonOf,
    replacementOf,
    TEST_FILE,
    valueLines,
    written,
} from './ground-shared-or-inline.forms.js';
import {
    capFinding,
    fixOversizedValues,
    oversizedValues,
} from './ground-shared-or-inline.oversized.js';
import {
    checkGroundPlacement,
    fixGroundPlacement,
    pathsModuleTestsName,
} from './ground-shared-or-inline.placement.js';
import { checkInlineSeeds, fixInlineSeeds } from './ground-shared-or-inline.seeds.js';

const DISK_LITERAL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>\s*\)/gu;

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
