import {
    blankComments,
    forgetTree,
    GROUND_EXPECTED,
    isGroundFolder,
    treeKind,
} from '@jterrazz/typescript/rules';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { withoutEntryImport } from '../../kit/checker/entry-import.js';
import { documentReferences, RELATIVE_LITERAL } from '../../kit/project/ground-readers.js';
import { isTestsFolderGround, moduleTestsOf } from '../../kit/project/module-tests.js';
import { isRelativePath } from '../../kit/project/relative-path.js';
import { closingOf } from '../../kit/project/source-scan.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { findSpecsRoots, isWithin, listFiles } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';
import { sourceCopiedBy } from './ground-shared-or-inline.copies.js';
import {
    INLINE_CAPS,
    isFrozen,
    isWrittenInPlace,
    jsonOf,
    replacementOf,
    survivesInPlace,
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

const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;

const TEST_CALL = /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(/gu;

// invariant: a form is read from the text around its reference, as far as this many characters.
const AROUND = 300;

type Reference = {
    after: string;
    before: string;
    column: number;
    end: number;
    file: string;
    namesAFile: boolean;
    line: number;
    start: number;
    target: string;
    test: string | undefined;
};

function testSpans(text: string): { end: number; start: number }[] {
    return [...text.matchAll(TEST_CALL)].map((match) => ({
        end: closingOf(text, match.index + match[0].length - 1),
        start: match.index,
    }));
}

function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, index);
    return { column: index - before.lastIndexOf('\n'), line: before.split('\n').length };
}

function roleOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundFolder(segment));
}

function referencesIn(file: string): Reference[] {
    const text = blankComments(readFileSync(file, 'utf8'));
    // invariant: a module that is no test is read by every test importing it: what it names is shared.
    const isTest = TEST_FILE.test(file);
    const spans = testSpans(text);
    const references: Reference[] = [];
    for (const match of text.matchAll(DISK_LITERAL)) {
        // Stryker disable next-line OptionalChaining: a match always carries its named groups
        const path = match.groups?.path ?? '';
        if (!isRelativePath(path) || path.includes('${')) {
            continue;
        }
        // Stryker disable next-line EqualityOperator: a disk call starts neither where its test call does nor at its closing parenthesis
        const inside = spans.findLast((span) => span.start < match.index && match.index < span.end);
        // Stryker disable next-line OptionalChaining: a match always carries its named groups
        const namesAFile = match.groups?.kind === 'file';
        const end = match.index + match[0].length;
        references.push({
            ...positionOf(text, match.index),
            after: text.slice(end, end + AROUND),
            before: text.slice(Math.max(0, match.index - AROUND), match.index),
            end,
            file,
            namesAFile,
            start: match.index,
            target: resolve(dirname(file), path),
            test: inside === undefined || !isTest ? undefined : `${file}:${inside.start}`,
        });
    }
    return references;
}

// invariant: a JSON file counts as the fixer writes its value.
function inPlaceLines(path: string, content: string): number {
    const parsed = path.endsWith('.json') ? jsonOf(content) : undefined;
    return valueLines(parsed === undefined ? content : JSON.stringify(parsed, null, 4));
}

// invariant: a text no literal survives in place (one opening on a line break whose lines share an indentation, which the comparison's dedent strips from either form) keeps its file.
function staysAFile(path: string, cap: number): boolean {
    const bytes = readFileSync(path);
    if (bytes.subarray(0, 8000).includes(0)) {
        return true;
    }
    const content = bytes.toString('utf8');
    const valued = path.endsWith('.json') && jsonOf(content) !== undefined;
    return inPlaceLines(path, content) > cap || (!valued && !survivesInPlace(content));
}

type SingleUse = { copyOf?: string; reference: Reference; references: number; target: string };

// invariant: a reference outside every test (a top-level `const`, a helper) counts as shared: no scan can count its readers.
function oneTestReads(named: readonly Reference[]): Reference | undefined {
    const [only] = named;
    const tests = new Set(named.map((reference) => reference.test));
    // Stryker disable next-line OptionalChaining: a target is grouped from at least one reference
    return only?.test !== undefined && tests.size === 1 ? only : undefined;
}

function inlinable(reference: Reference, target: string): boolean {
    // Stryker disable next-line StringLiteral: no role is named by any text a role-less path stands for
    const cap = INLINE_CAPS[roleOf(written(reference.file, target)) ?? ''];
    return (
        cap !== undefined &&
        reference.namesAFile &&
        treeKind(target) === 'file' &&
        !staysAFile(target, cap) &&
        // invariant: the checker asks only what the fixer writes: a golden whose form the fixer leaves is left by both.
        !isFrozen(reference.after) &&
        isWrittenInPlace(reference.before, target)
    );
}

// invariant: a document's `fixture:` line, an import and a path joined to `import.meta.dirname` read a ground file as surely as `file()` does, and keep it a file.
function readersBesidesDiskCalls(root: string): string[] {
    // Stryker disable OptionalChaining: a match always carries its named groups
    const sources = listFiles(root, (path) => SOURCE_FILE.test(path)).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(RELATIVE_LITERAL)]
            .filter((found) => !/(?:file|directory)\(/u.test(String(found.groups?.lead)))
            .map((found) => resolve(dirname(file), String(found.groups?.path))),
    );
    // Stryker restore OptionalChaining
    return [...sources, ...documentReferences(root).map(({ target }) => target)];
}

function singleUseFiles(rootDir: string): SingleUse[] {
    const roots = findSpecsRoots(rootDir);
    const references = roots.flatMap((root) => [
        ...listFiles(root, (path) => SOURCE_FILE.test(path)).flatMap((file) => referencesIn(file)),
        // invariant: a module test's ground stands inside its `__tests__/`, and is judged by the law a specification's is.
        ...moduleTestsOf(dirname(root))
            .flatMap((file) => referencesIn(file))
            .filter((reference) => isTestsFolderGround(reference.target)),
    ]);
    const namedOutside = roots.flatMap((root) => [
        ...pathsModuleTestsName(dirname(root)).filter((path) => isWithin(root, path)),
        ...readersBesidesDiskCalls(root),
    ]);
    const byTarget = new Map<string, Reference[]>();
    for (const reference of references) {
        byTarget.set(reference.target, [...(byTarget.get(reference.target) ?? []), reference]);
    }
    const single: SingleUse[] = [];
    for (const [target, named] of byTarget) {
        const only = oneTestReads(named);
        const shared = namedOutside.some((path) => path === target || isWithin(path, target));
        if (only !== undefined && !shared && inlinable(only, target)) {
            const copy = sourceCopiedBy(rootDir, target);
            // Stryker disable next-line ConditionalExpression: a key holding undefined reads as no copy to every reader
            const copied = copy === undefined ? {} : { copyOf: copy };
            single.push({
                ...copied,
                reference: only,
                references: named.length,
                target,
            });
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
    const single = singleUseFiles(rootDir).map(({ copyOf, reference, target }) => ({
        column: reference.column,
        path: relative(rootDir, reference.file),
        line: reference.line,
        fix:
            copyOf === undefined
                ? `write it here, ${inPlaceForm(reference)}, and delete the file; \`typescript fix\` inlines it`
                : `compare with the source: read ${relative(rootDir, copyOf)} instead, and delete the copy; \`typescript fix\` leaves it to you`,
        found: `${relative(isWithin(rootDir, target) ? rootDir : dirname(rootDir), target)}, ${copyOf === undefined ? '' : `a byte copy of ${relative(rootDir, copyOf)}, `}read by this test alone`,
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
    // Stryker disable next-line StringLiteral: a literal blanked to nothing hides a call as well as one blanked to ''
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
    for (const use of singleUseFiles(rootDir).filter(
        ({ copyOf, references }) => references === 1 && copyOf === undefined,
    )) {
        byFile.set(use.reference.file, [...(byFile.get(use.reference.file) ?? []), use]);
    }
    for (const [file, uses] of byFile) {
        let text = readFileSync(file, 'utf8');
        for (const { reference, target } of uses.toSorted(
            (a, b) => b.reference.start - a.reference.start,
        )) {
            const line = text.slice(text.lastIndexOf('\n', reference.start) + 1);
            const indent = line.slice(0, line.length - line.trimStart().length);
            const replacement = replacementOf(
                text.slice(0, reference.start),
                readFileSync(target, 'utf8'),
                target,
                indent,
            );
            // Stryker disable next-line ConditionalExpression: `inlinable` asked `replacementOf` the same question of the same text before the use was listed, and a frozen call was left out there
            if (replacement === undefined) {
                continue;
            }
            text = text.slice(0, reference.start) + replacement + text.slice(reference.end);
            rmSync(target);
            emptied.add(dirname(target));
            done.push(
                `inlined ${relative(rootDir, target)} → ${relative(rootDir, file)}:${reference.line}`,
            );
        }
        writeFileSync(file, importsOf(text));
    }
    removeEmptied(emptied);
    // Stryker disable next-line BlockStatement,CallExpression: the placement below reads no file this pass deleted; the passes after it read the tree afresh
    forgetTree();
    done.push(...fixGroundPlacement(rootDir).map((move) => `moved ${move}`));
    return done;
}
