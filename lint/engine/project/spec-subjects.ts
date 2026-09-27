import { blankComments, treeKind } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { projectRootOf } from './role.js';
import { specimenOf } from './specimen.js';
import {
    closingOf,
    declaredCommands,
    doorsOf,
    SUBJECT_FACETS,
    subjectFolder,
    subjectName,
    subjectsOf,
} from './subject.js';
import type { Subject, SubjectReading } from './subject.js';
import { suppressedLines } from './suppression.js';
import { testSettingsAtSync } from './test-section.js';
import { listFiles } from './tree.js';

/** A spec of a specimen (`lint/engine/project/specimen.ts`) is out of reach: it is filed by the capability it specifies. Every move keeps each path the code names pointing where it pointed. */

export type Span = { end: number; start: number };

export type TestOf = Span & { subjects: string[]; title: string };

export type SpecRead = {
    facet: string;
    file: string;
    reading: SubjectReading;
    subjects: Map<string, { index: number; subject: Subject }>;
    tests: TestOf[];
    text: string;
};

export const TEST_CALL = /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(/gu;

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
    while (begin > 0) {
        const previous = lineStart(text, begin - 1);
        const line = text.slice(previous, begin).trim();
        if (line.startsWith('//')) {
            begin = previous;
        } else if (line.endsWith('*/')) {
            // The doc comment a declaration opens on goes with it.
            const opening = text.lastIndexOf(
                '/*',
                previous + text.slice(previous, begin).lastIndexOf('*/'),
            );
            begin = lineStart(text, opening);
        } else {
            break;
        }
    }
    return begin;
}

function testsOf(source: string): Omit<TestOf, 'subjects'>[] {
    const text = blankComments(source);
    const tests: Omit<TestOf, 'subjects'>[] = [];
    for (const found of text.matchAll(TEST_CALL)) {
        if (tests.some((test) => found.index >= test.start && found.index < test.end)) {
            continue;
        }
        const open = found.index + found[0].length - 1;
        const close = closingOf(text, open);
        tests.push({
            end: lineEnd(text, close),
            start: withLeadingComments(source, found.index),
            title: TITLE.exec(text.slice(open + 1))?.groups?.title ?? '(a computed title)',
        });
    }
    return tests;
}

function facetOf(specsRoot: string, file: string): string {
    return relative(specsRoot, file).split(/[/\\]/u)[0] ?? '';
}

function readBeside(file: string, path: string): string | undefined {
    const target = resolve(dirname(file), path);
    return treeKind(target) === 'file' ? readFileSync(target, 'utf8') : undefined;
}

function readingOf(specsRoot: string, file: string, text: string): SubjectReading {
    const { collections, methodless } = testSettingsAtSync(
        projectRootOf(specsRoot) ?? dirname(specsRoot),
    );
    const commands: Record<string, readonly string[]> = {};
    for (const [handle, door] of Object.entries(doorsOf(blankComments(text), 'cli'))) {
        const source = readBeside(file, door.replace(/\.js$/u, '.ts'));
        const declared = source === undefined ? undefined : declaredCommands(source);
        if (declared !== undefined) {
            commands[handle] = declared;
        }
    }
    return { collections, commands, methodless };
}

function readSpec(specsRoot: string, file: string): SpecRead {
    const text = readFileSync(file, 'utf8');
    const facet = facetOf(specsRoot, file);
    const reading = readingOf(specsRoot, file, text);
    const reached = subjectsOf(text, (path) => readBeside(file, path), reading).filter(
        ({ subject }) => subject.facet === facet,
    );
    const subjects = new Map<string, { index: number; subject: Subject }>();
    for (const at of reached) {
        const name = subjectName(at.subject);
        if (!subjects.has(name)) {
            subjects.set(name, at);
        }
    }
    const tests = testsOf(text).map(({ end, start, title }) => ({
        end,
        start,
        title,
        subjects: [
            ...new Set(
                reached
                    .filter(({ index }) => index >= start && index < end)
                    .map(({ subject }) => subjectName(subject)),
            ),
        ],
    }));
    return { facet, file, reading, subjects, tests, text };
}

export function subjectSpecs(specsRoot: string): SpecRead[] {
    return listFiles(specsRoot, (path) => path.endsWith('.spec.ts'))
        .filter((file) => (SUBJECT_FACETS as readonly string[]).includes(facetOf(specsRoot, file)))
        .map((file) => readSpec(specsRoot, file))
        .filter((spec) => specimenOf(spec.file, spec.text, spec.facet) === undefined);
}

export function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, index);
    return { column: index - lineStart(text, index) + 1, line: before.split('\n').length };
}

export function aspectOf(file: string): string {
    return basename(file).replace(/\.spec\.ts$/u, '');
}

/** `/articles/:id` → `articles-id`. */
function slugOf(name: string): string {
    return (
        name
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/gu, '-')
            .replaceAll(/^-|-$/gu, '') || 'root'
    );
}

export function targetOf(
    specsRoot: string,
    spec: SpecRead,
    name: string,
    keepsName: boolean,
): string {
    const subject = spec.subjects.get(name)?.subject;
    const folder = subject === undefined ? undefined : subjectFolder(subject, spec.reading);
    const aspect = aspectOf(spec.file);
    if (folder === undefined) {
        return keepsName
            ? spec.file
            : join(
                  dirname(spec.file),
                  `${aspect}-${slugOf(name.split(' ').at(-1) ?? name)}.spec.ts`,
              );
    }
    return join(specsRoot, spec.facet, folder, `${aspect}.spec.ts`);
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

/** A journey goes with the subject its chain starts on. */
export function splitPlan(specsRoot: string, spec: SpecRead): Map<string, string> {
    const plan = new Map<string, string>();
    for (const [position, name] of openedSubjects(spec).entries()) {
        plan.set(name, targetOf(specsRoot, spec, name, position === 0));
    }
    return plan;
}

export function secondSubjectAt(spec: SpecRead): { column: number; line: number } {
    const [, second] = [...spec.subjects.values()];
    return positionOf(spec.text, second?.index ?? 0);
}

export function silenced(spec: SpecRead, rule: string): boolean {
    const line = spec.subjects.size > 1 ? secondSubjectAt(spec).line : 1;
    return suppressedLines(spec.text, rule).has(line);
}

export function shown(specsRoot: string, path: string): string {
    return relative(specsRoot, path).split(sep).join('/');
}
