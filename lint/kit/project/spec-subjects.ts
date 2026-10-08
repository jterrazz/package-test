import { blankComments, treeKind } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { declaredCommands } from './command-words.js';
import { projectRootOf } from './role.js';
import { closingOf } from './source-scan.js';
import { doorsOf, SUBJECT_SPECIFICATIONS } from './spec-chains.js';
import { specimenOf } from './specimen.js';
import { subjectFolder, subjectName, subjectsOf } from './subject.js';
import type { Subject, SubjectReading } from './subject.js';
import { suppressedLines } from './suppression.js';
import { testSettingsAtSync } from './test-section.js';
import { listFiles } from './tree.js';

/** A spec of a specimen (`lint/kit/project/specimen.ts`) is out of reach: it is filed by the capability it specifies. Every move keeps each path the code names pointing where it pointed. */

export type Span = { end: number; start: number };

export type TestOf = Span & { subjects: string[]; title: string };

export type SpecRead = {
    specification: string;
    file: string;
    reading: SubjectReading;
    subjects: Map<string, { index: number; subject: Subject }>;
    tests: TestOf[];
    text: string;
};

// invariant: a pattern is built per scan: a shared global one would carry its `lastIndex` from one text into the next.
const TEST_CALL = String.raw`(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(`;

export function holdsTestCall(text: string): boolean {
    // Stryker disable next-line StringLiteral: the pattern spells no character past ASCII, so it reads alike with or without the unicode flag
    return new RegExp(TEST_CALL, 'u').test(text);
}

export function testCallCount(text: string): number {
    return [...text.matchAll(new RegExp(TEST_CALL, 'gu'))].length;
}

const TITLE = /^\s*(?<quote>['"`])(?<title>(?:[^\\]|\\.)*?)\k<quote>/u;

export function lineStart(text: string, index: number): number {
    return text.lastIndexOf('\n', index - 1) + 1;
}

export function lineEnd(text: string, index: number): number {
    const end = text.indexOf('\n', index);
    return end === -1 ? text.length : end + 1;
}

export function withLeadingComments(text: string, start: number): number {
    let begin = lineStart(text, start);
    // invariant: above the first line, the line read is empty, which ends the climb.
    for (;;) {
        const previous = lineStart(text, begin - 1);
        const line = text.slice(previous, begin).trim();
        if (line.startsWith('//')) {
            begin = previous;
        } else if (line.endsWith('*/')) {
            // invariant: the doc comment a declaration opens on goes with it, and a block comment holds no other opening.
            begin = lineStart(text, text.lastIndexOf('/*', begin));
        } else {
            break;
        }
    }
    return begin;
}

// invariant: `test.each(rows)('title', …)` is one test: its span runs to the close of its last call, its title read from that call.
function lastCallOf(text: string, open: number): { close: number; open: number } {
    const close = closingOf(text, open);
    const next = /^\s*\(/u.exec(text.slice(close + 1));
    return next === null ? { close, open } : lastCallOf(text, close + next[0].length);
}

/** Each top-level test of a source: its span with the comments above it, and its literal title. */
export function testsIn(source: string): Omit<TestOf, 'subjects'>[] {
    const text = blankComments(source);
    const tests: Omit<TestOf, 'subjects'>[] = [];
    for (const found of text.matchAll(new RegExp(TEST_CALL, 'gu'))) {
        // invariant: a call is found after every test already read, so it is inside one when before its end.
        if (tests.some((test) => found.index < test.end)) {
            continue;
        }
        const { close, open } = lastCallOf(text, found.index + found[0].length - 1);
        const { title = '(a computed title)' } = TITLE.exec(text.slice(open + 1))?.groups ?? {};
        tests.push({
            end: lineEnd(text, close),
            start: withLeadingComments(source, found.index),
            title,
        });
    }
    return tests;
}

function specificationOf(specsRoot: string, file: string): string {
    return relative(specsRoot, file).split(/[/\\]/u)[0] ?? '';
}

function readBeside(file: string, path: string): string | undefined {
    const target = resolve(dirname(file), path);
    return treeKind(target) === 'file' ? readFileSync(target, 'utf8') : undefined;
}

function readingOf(specsRoot: string, file: string, text: string): SubjectReading {
    const { basePath, collections, methodless } = testSettingsAtSync(
        projectRootOf(specsRoot) ?? dirname(specsRoot),
    );
    const commands: Record<string, readonly string[]> = {};
    for (const [handle, door] of Object.entries(doorsOf(blankComments(text), 'cli'))) {
        const source = readBeside(file, door.replace(/(?:\.[jt]s)?$/u, '.ts'));
        const declared = source === undefined ? undefined : declaredCommands(source);
        if (declared !== undefined) {
            commands[handle] = declared;
        }
    }
    return { basePath, collections, commands, methodless };
}

/** A spec as the disk holds it now: its text, its specification, its tests and the subjects they open. */
export function readSpec(specsRoot: string, file: string): SpecRead {
    const text = readFileSync(file, 'utf8');
    const specification = specificationOf(specsRoot, file);
    const reading = readingOf(specsRoot, file, text);
    const spans = testsIn(text);
    const opened = subjectsOf(text, (path) => readBeside(file, path), reading).filter(
        ({ subject }) => subject.specification === specification,
    );
    // invariant: a mobile test that opens the app again proves what the first open left behind: its later opens are the relaunch, never a second subject.
    const reached =
        specification === 'mobile'
            ? opened.filter(({ index }) => {
                  // Stryker disable next-line EqualityOperator: a chain never starts on a test's first character nor on its last
                  const span = spans.find((test) => index >= test.start && index < test.end);
                  return (
                      span === undefined ||
                      // Stryker disable next-line OptionalChaining,EqualityOperator,ConditionalExpression: the chains are in source order and this one is in the span, so the first at or past its start is the span's first
                      opened.find((other) => other.index >= span.start && other.index < span.end)
                          ?.index === index
                  );
              })
            : opened;
    const subjects = new Map<string, { index: number; subject: Subject }>();
    for (const at of reached) {
        const name = subjectName(at.subject);
        if (!subjects.has(name)) {
            subjects.set(name, at);
        }
    }
    const tests = spans.map(({ end, start, title }) => {
        // Stryker disable next-line EqualityOperator: a call never sits on the first character of a test or its comments
        const inside = reached.filter(({ index }) => index >= start && index < end);
        return {
            end,
            start,
            subjects: [...new Set(inside.map(({ subject }) => subjectName(subject)))],
            title,
        };
    });
    return { specification, file, reading, subjects, tests, text };
}

export function subjectSpecs(specsRoot: string): SpecRead[] {
    return listFiles(specsRoot, (path) => path.endsWith('.spec.ts'))
        .filter((file) =>
            (SUBJECT_SPECIFICATIONS as readonly string[]).includes(
                specificationOf(specsRoot, file),
            ),
        )
        .map((file) => readSpec(specsRoot, file))
        .filter((spec) => specimenOf(spec.file, spec.text, spec.specification) === undefined);
}

export function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, index);
    return { column: index - lineStart(text, index) + 1, line: before.split('\n').length };
}

export function aspectOf(file: string): string {
    return basename(file, '.spec.ts');
}

/** Where a spec of this subject is filed: `undefined` for a subject with no standard folder (a page, a journey, the root route), whose file name nobody but its author can choose. */
export function targetOf(specsRoot: string, spec: SpecRead, name: string): string | undefined {
    const reached = spec.subjects.get(name);
    // Stryker disable next-line ConditionalExpression: a name a test opens on is a subject of its spec
    const folder = reached === undefined ? undefined : subjectFolder(reached.subject, spec.reading);
    return folder === undefined
        ? undefined
        : join(specsRoot, spec.specification, folder, `${aspectOf(spec.file)}.spec.ts`);
}

export function openedSubjects(spec: SpecRead): string[] {
    return [
        ...new Set(
            spec.tests.flatMap((test) =>
                test.subjects[0] === undefined ? [] : [test.subjects[0]],
            ),
        ),
    ];
}

/** A journey goes with the subject its chain starts on; the first subject keeps the file when no folder holds it, and a later one with no folder is left out — the split refuses to name its file. */
export function splitPlan(specsRoot: string, spec: SpecRead): Map<string, string> {
    const plan = new Map<string, string>();
    for (const [position, name] of openedSubjects(spec).entries()) {
        const target = targetOf(specsRoot, spec, name) ?? (position === 0 ? spec.file : undefined);
        if (target !== undefined) {
            plan.set(name, target);
        }
    }
    return plan;
}

/** A spec of one subject has no second: its first line stands for it. */
export function secondSubjectAt(spec: SpecRead): { column: number; line: number } {
    const [, second] = [...spec.subjects.values()];
    return positionOf(spec.text, second?.index ?? 0);
}

export function silenced(spec: SpecRead, rule: string): boolean {
    return suppressedLines(spec.text, rule).has(secondSubjectAt(spec).line);
}

export function shown(specsRoot: string, path: string): string {
    return relative(specsRoot, path).split(sep).join('/');
}
