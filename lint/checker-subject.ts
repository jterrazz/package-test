import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import {
    forgetTree,
    moveKeepingHistory,
    treeEntries,
    treeKind,
} from '../src/kernel/files/git-tree.js';
import { GROUND_DIRS, SHARED_GROUND } from '../src/kernel/files/ground.js';
import { listFiles, repointModuleTests, suppressedLines } from './checker-crossfile.js';
import type { TokenViolation } from './checker.js';
import { projectRootOf } from './role.js';
import { specimenOf } from './specimen.js';
import {
    ambiguousSegment,
    closingOf,
    declaredCommands,
    doorsOf,
    literalEnd,
    SUBJECT_FACETS,
    subjectFolder,
    subjectName,
    subjectsOf,
    withoutComments,
} from './subject.js';
import type { Subject, SubjectReading } from './subject.js';
import { testSettingsAt } from './test-settings.js';

/**
 * C29 and C30 — a spec file is about ONE subject, filed under that subject's
 * standard name. A spec of a specimen (`lint/specimen.ts`) is out of their
 * reach: it is filed by the capability it specifies.
 *
 * The subject is what the file's chains reach (`lint/subject.ts`): a route, a
 * job, a command, a page, a journey. A file that reaches several is several
 * files, and `--fix` splits it — each test to the file of the subject it
 * reaches, keeping the imports and the file-level constants it uses, what
 * two of the new files read moved once into their folder's fixtures module. A file
 * about one subject whose name the tree derives (api, job, cli) lives in that
 * folder, and `--fix` moves it there. Either move keeps every path the code
 * names pointing where it pointed, and sends the ground the old leaf holds for
 * another leaf up to the specs root's shared ground, where C28's own fix moves
 * each entry down to the one leaf that reads it.
 */

/** A source span, by offsets. */
type Span = { end: number; start: number };

/** One test of a spec file: where it stands, its title, and what it reaches. */
type TestOf = Span & { subjects: string[]; title: string };

/** A spec file read for its subjects. */
type SpecRead = {
    /** The facet folder the file sits in. */
    facet: string;
    file: string;
    /** What the repository declared that its subjects are read with. */
    reading: SubjectReading;
    /** Every subject the file's chains reach, in order of first appearance, by name. */
    subjects: Map<string, { index: number; subject: Subject }>;
    tests: TestOf[];
    text: string;
};

/** The start of a test's call: `test(`, `it(`, and their modifiers (`test.each(…)(`). */
const TEST_CALL = /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(/gu;

/** The literal title a test call opens on. */
const TITLE = /^\s*(?<quote>['"`])(?<title>(?:[^\\]|\\.)*?)\k<quote>/u;

/** The offset where the line holding `index` starts. */
function lineStart(text: string, index: number): number {
    return text.lastIndexOf('\n', index - 1) + 1;
}

/** The offset past the line holding `index`, its newline included. */
function lineEnd(text: string, index: number): number {
    const end = text.indexOf('\n', index);
    return end === -1 ? text.length : end + 1;
}

/** Where a test's lines begin: its own line, and the comment lines right above it. */
function withLeadingComments(text: string, start: number): number {
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

/** The tests of a file, each by the whole lines it takes, in order. */
function testsOf(source: string): Omit<TestOf, 'subjects'>[] {
    const text = withoutComments(source);
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

/** The facet folder a spec sits in, below the specs root. */
function facetOf(specsRoot: string, file: string): string {
    return relative(specsRoot, file).split(/[/\\]/u)[0] ?? '';
}

/** A file the spec names by a relative path, read — `undefined` when the tree holds none there. */
function readBeside(file: string, path: string): string | undefined {
    const target = resolve(dirname(file), path);
    return treeKind(target) === 'file' ? readFileSync(target, 'utf8') : undefined;
}

/**
 * What the spec's subjects are read with: the irregular collections and the
 * method-less routes of the unit's `jterrazz.config.ts`, and the command list of each runner the spec
 * imports a `cli` from, by the handle it holds that runner by.
 */
function readingOf(specsRoot: string, file: string, text: string): SubjectReading {
    const { collections, methodless } = testSettingsAt(
        projectRootOf(specsRoot) ?? dirname(specsRoot),
    );
    const commands: Record<string, readonly string[]> = {};
    for (const [handle, door] of Object.entries(doorsOf(withoutComments(text), 'cli'))) {
        const source = readBeside(file, door.replace(/\.js$/u, '.ts'));
        const declared = source === undefined ? undefined : declaredCommands(source);
        if (declared !== undefined) {
            commands[handle] = declared;
        }
    }
    return { collections, commands, methodless };
}

/** Read one spec for its subjects and its tests. */
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

/**
 * Every `.spec.ts` of a facet whose chains reach a subject of the project's
 * own app — a spec of a specimen is filed by its capability, never by
 * the route, the job or the command it reaches.
 */
function subjectSpecs(specsRoot: string): SpecRead[] {
    return listFiles(specsRoot, (path) => path.endsWith('.spec.ts'))
        .filter((file) => (SUBJECT_FACETS as readonly string[]).includes(facetOf(specsRoot, file)))
        .map((file) => readSpec(specsRoot, file))
        .filter((spec) => specimenOf(spec.file, spec.text, spec.facet) === undefined);
}

/** The 1-based line and column of an offset. */
function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, index);
    return { column: index - lineStart(text, index) + 1, line: before.split('\n').length };
}

/** The aspect a spec file names: `pagination.spec.ts` → `pagination`. */
function aspectOf(file: string): string {
    return basename(file).replace(/\.spec\.ts$/u, '');
}

/** A subject as the words of a file name: `/articles/:id` → `articles-id`. */
function slugOf(name: string): string {
    return (
        name
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/gu, '-')
            .replaceAll(/^-|-$/gu, '') || 'root'
    );
}

/**
 * Where the file of one subject goes: its standard name's folder under the
 * facet, or — for a subject with none — beside the file, named for it.
 */
function targetOf(specsRoot: string, spec: SpecRead, name: string, keepsName: boolean): string {
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

/** A test whose own chains reach several subjects — a journey no cut can separate. */
function journeyOf(spec: SpecRead): TestOf | undefined {
    return spec.tests.find((test) => test.subjects.length > 1);
}

/** The subjects the file's tests open on, in order: each is one file of a split. */
function openedSubjects(spec: SpecRead): string[] {
    return [
        ...new Set(
            spec.tests.flatMap((test) =>
                test.subjects[0] === undefined ? [] : [test.subjects[0]],
            ),
        ),
    ];
}

/**
 * The files a split writes, one per subject a test opens on — a journey goes
 * with the subject its chain starts on; the first keeps the file's name where
 * the subject has no folder.
 */
function splitPlan(specsRoot: string, spec: SpecRead): Map<string, string> {
    const plan = new Map<string, string>();
    for (const [position, name] of openedSubjects(spec).entries()) {
        plan.set(name, targetOf(specsRoot, spec, name, position === 0));
    }
    return plan;
}

/** What C29 tells the author of a file reaching several subjects to do. */
function splitAdvice(specsRoot: string, spec: SpecRead): string {
    const journey = journeyOf(spec);
    const targets = [...splitPlan(specsRoot, spec).values()].map((path) => shown(specsRoot, path));
    const seed =
        journey === undefined
            ? ''
            : `the test "${journey.title}" reaches ${journey.subjects.join(' and ')} — state what it stands on with a seed, and keep one subject per test`;
    if (targets.length < 2) {
        return seed;
    }
    const split = `split it, one file per subject — ${targets.join(', ')} — \`make fix\` splits it`;
    return journey === undefined ? split : `${split}; ${seed}`;
}

/** Where C29 reports a file: the first chain that reaches a second subject. */
function secondSubjectAt(spec: SpecRead): { column: number; line: number } {
    const [, second] = [...spec.subjects.values()];
    return positionOf(spec.text, second?.index ?? 0);
}

/** Has the file's author silenced this finding — `checker-disable-line c29|c30 -- <reason>`? */
function silenced(spec: SpecRead): boolean {
    return spec.subjects.size > 1
        ? suppressedLines(spec.text, 'c29').has(secondSubjectAt(spec).line)
        : suppressedLines(spec.text, 'c30').has(1);
}

/** A path as the report prints it, below the specs root. */
function shown(specsRoot: string, path: string): string {
    return relative(specsRoot, path).split(sep).join('/');
}

/**
 * CONVENTIONS C29 — every chain of a spec file reaches one subject. Reported
 * at the first chain that reaches a second one.
 */
export function checkOneSubject(specsRoot: string): TokenViolation[] {
    return subjectSpecs(specsRoot).flatMap((spec) => {
        if (spec.subjects.size < 2 || silenced(spec)) {
            return [];
        }
        const names = [...spec.subjects.keys()];
        return [
            {
                ...secondSubjectAt(spec),
                file: shown(specsRoot, spec.file),
                fix: splitAdvice(specsRoot, spec),
                found: `a spec reaching ${names.length} subjects — ${names.join(', ')}`,
                rule: 'c29-one-subject' as const,
                severity: 'error' as const,
            },
        ];
    });
}

/**
 * The C30 finding of a subject whose path holds a word that may be a value:
 * no folder is derived from it, and the author writes the template that says
 * which it is. Reported at the chain that sends it.
 */
function ambiguityOf(specsRoot: string, spec: SpecRead, name: string): TokenViolation | undefined {
    const at = spec.subjects.get(name);
    const segment = at === undefined ? undefined : ambiguousSegment(at.subject, spec.reading);
    if (at === undefined || segment === undefined || at.subject.facet !== 'api') {
        return undefined;
    }
    const { method, path } = at.subject;
    const verb = method.toLowerCase();
    const bare = path.split(/[?#]/u)[0] ?? '';
    const template = bare.replace(`/${segment}/`, '/:<name>/');
    const collection = bare.split('/').at(bare.split('/').indexOf(segment) - 1) ?? '';
    return {
        ...positionOf(spec.text, at.index),
        file: shown(specsRoot, spec.file),
        fix: `write the route's template: \`.${verb}('${template}', { params: { <name>: '${segment}' } })\` — or, if \`${segment}\` is the route's own segment, state that the path is the route: \`.${verb}('${bare}', { params: {} })\``,
        found: `\`${method} ${bare}\` names \`${segment}\` right after the collection \`${collection}\`: a value or a segment of the route, and the folder depends on which`,
        rule: 'c30-subject-folder' as const,
        severity: 'error' as const,
    };
}

/**
 * CONVENTIONS C30 — a spec file about one subject sits in its subject's
 * standard folder. Reported at the file's first line; a subject whose path
 * reads two ways is reported at its chain, and never moved.
 */
export function checkSubjectFolder(specsRoot: string): TokenViolation[] {
    return subjectSpecs(specsRoot).flatMap((spec) => {
        const [only] = [...spec.subjects.keys()];
        if (spec.subjects.size !== 1 || only === undefined || silenced(spec)) {
            return [];
        }
        const ambiguity = ambiguityOf(specsRoot, spec, only);
        if (ambiguity !== undefined) {
            return [ambiguity];
        }
        const target = targetOf(specsRoot, spec, only, true);
        if (dirname(target) === dirname(spec.file)) {
            return [];
        }
        return [
            {
                file: shown(specsRoot, spec.file),
                fix: `move it to ${shown(specsRoot, target)} — \`make fix\` moves it, and the ground it stands on`,
                found: `a spec of ${only}, filed under ${shown(specsRoot, dirname(spec.file))}/`,
                line: 1,
                rule: 'c30-subject-folder' as const,
                severity: 'error' as const,
            },
        ];
    });
}

// ── Fix ──

/** An import clause: its default name, its named specifiers, and where it stands. */
type ImportClause = Span & {
    defaultName: string | undefined;
    named: { local: string; text: string }[];
    source: string;
    typeOnly: boolean;
};

/** `import x, { a, b as c } from '…';` — a named or default import, across lines. */
const IMPORT =
    /^import\s+(?<type>type\s+)?(?:(?<plain>[\w$]+)\s*,?\s*)?(?:\{(?<named>[^}]*)\})?\s*from\s+(?<quote>['"])(?<source>[^'"]+)\k<quote>;?[ \t]*\n?/gmu;

/** The import clauses of a file. */
function importsOf(text: string): ImportClause[] {
    return [...text.matchAll(IMPORT)].map((found) => ({
        defaultName: found.groups?.plain,
        end: found.index + found[0].length,
        named: (found.groups?.named ?? '')
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry !== '')
            .map((entry) => ({
                local: (entry.split(/\s+as\s+/u).at(-1) ?? entry).replace(/^type\s+/u, ''),
                text: entry,
            })),
        source: found.groups?.source ?? '',
        start: found.index,
        typeOnly: found.groups?.type !== undefined,
    }));
}

/** An import clause written back with only the names it keeps — nothing when it keeps none. */
function importText(clause: ImportClause, keeps: (local: string) => boolean): string {
    const plain =
        clause.defaultName !== undefined && keeps(clause.defaultName)
            ? clause.defaultName
            : undefined;
    const named = clause.named.filter((name) => keeps(name.local)).map((name) => name.text);
    const parts = [plain, named.length === 0 ? undefined : `{ ${named.join(', ')} }`].filter(
        (part) => part !== undefined,
    );
    return parts.length === 0
        ? ''
        : `import ${clause.typeOnly ? 'type ' : ''}${parts.join(', ')} from '${clause.source}';\n`;
}

/**
 * The code alone: comments, strings and regular expressions blanked — a name
 * written in a message (`'cli-app'`, `'the text'`) is no read of it. A
 * template stays whole, since what its holes hold is code.
 */
function codeOnly(text: string): string {
    const blank = withoutComments(text);
    let out = '';
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            out += blank[index] ?? '';
            index += 1;
            continue;
        }
        const literal = blank.slice(index, end);
        out += literal.startsWith('`') ? literal : literal.replaceAll(/[^\n]/gu, ' ');
        index = end;
    }
    return out;
}

/** Is `name` read anywhere in `text` outside the span it is declared in? */
function isRead(text: string, name: string, declared: Span): boolean {
    const body = codeOnly(`${text.slice(0, declared.start)}\n${text.slice(declared.end)}`);
    return new RegExp(
        String.raw`(?<![\w$.])${name.replaceAll('$', String.raw`\$`)}(?![\w$])`,
        'u',
    ).test(body);
}

/** A file-level declaration, the comment lines above it included — a type's or a value's. */
type Declaration = Span & { name: string; type: boolean };

/** A top-level declaration's head: `const X`, `let X`, `function x`, `async function x`, `type X`, `interface X`. */
const DECLARATION =
    /^(?:(?:const|let)\s+(?<variable>[\w$]+)|(?:async\s+)?function\s*\*?\s*(?<fn>[\w$]+)|type\s+(?<alias>[\w$]+)|interface\s+(?<shape>[\w$]+))/gmu;

/** Where a top-level statement that opens at `start` ends: its `;`, or the brace closing a function's or an interface's body. */
function statementEnd(blank: string, start: number, isFunction: boolean): number {
    let index = start;
    while (index < blank.length) {
        const character = blank[index] ?? '';
        const past = literalEnd(blank, index);
        if (past !== index) {
            index = past;
            continue;
        }
        if (character === '(' || character === '[' || character === '{') {
            const close = closingOf(blank, index);
            // A function's body is the brace that closes its line: an object
            // type in its return annotation is followed by more of the head.
            if (
                isFunction &&
                character === '{' &&
                /^[ \t]*(?:\n|$)/u.test(blank.slice(close + 1))
            ) {
                return close + 1;
            }
            index = close + 1;
            continue;
        }
        if (character === ';') {
            return index + 1;
        }
        index += 1;
    }
    return blank.length;
}

/** The top-level `const`/`let`/`function`/`type`/`interface` declarations of a file — an export is read elsewhere, and kept. */
function declarationsOf(text: string): Declaration[] {
    const blank = withoutComments(text);
    return [...blank.matchAll(DECLARATION)].flatMap((match) => {
        const { alias, fn, shape, variable } = match.groups ?? {};
        const name = variable ?? fn ?? alias ?? shape;
        if (name === undefined) {
            return [];
        }
        const end = statementEnd(
            blank,
            match.index + match[0].length,
            fn !== undefined || shape !== undefined,
        );
        return [
            {
                end: lineEnd(text, end - 1),
                name,
                start: withLeadingComments(text, match.index),
                type: alias !== undefined || shape !== undefined,
            },
        ];
    });
}

/** The code with one file-level declaration nothing reads taken out — or as it was. */
function withoutAnUnreadDeclaration(text: string): string {
    const unread = declarationsOf(text).find(
        (declaration) => !isRead(text, declaration.name, declaration),
    );
    return unread === undefined ? text : text.slice(0, unread.start) + text.slice(unread.end);
}

/** The code with each import clause keeping only the names the rest of it reads. */
function withImportsPruned(text: string): string {
    const clauses = importsOf(text);
    // A name another import clause spells (`{ cli as vitestCli }`) is no read of it.
    const code = clauses
        .toReversed()
        .reduce((rest, clause) => rest.slice(0, clause.start) + rest.slice(clause.end), text);
    let current = text;
    for (const clause of clauses.toReversed()) {
        const kept = importText(clause, (local) => isRead(code, local, { end: 0, start: 0 }));
        current = current.slice(0, clause.start) + kept + current.slice(clause.end);
    }
    return current;
}

/** Drop the file-level declarations and the imports nothing left in the file reads. */
function pruned(text: string): string {
    let current = text;
    for (let previous = ''; previous !== current;) {
        previous = current;
        current = withoutAnUnreadDeclaration(current);
    }
    return withImportsPruned(current)
        .replaceAll(/\n{3,}/gu, '\n\n')
        .replace(/(?:\n[ \t]*\/\/[^\n]*|\n[ \t]*)+$/u, '\n');
}

/** A relative path from `from` to `to`, as the code spells one: `./x`, `../y`. */
function relativePath(from: string, to: string): string {
    const path = relative(from, to).split(sep).join('/');
    return path.startsWith('.') ? path : `./${path}`;
}

/** A literal path the code names, and the call or clause that names it. */
const RELATIVE_LITERAL =
    /(?<lead>(?<![.\w])(?:file|directory)\(\s*|\bfrom\s+|\bimport\(\s*|import\.meta\.dirname,\s*)(?<quote>['"])(?<path>\.\.?\/[^'"]*)\k<quote>/gu;

/** The spans of the file's string literals, templates and regular expressions — text, never a call. */
function literalSpans(text: string): Span[] {
    const blank = withoutComments(text);
    const spans: Span[] = [];
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            index += 1;
        } else {
            spans.push({ end, start: index });
            index = end;
        }
    }
    return spans;
}

/**
 * The code, every relative path it names rebased from `from` to `to`, pointing
 * where it pointed. A call spelled inside a string is text, and a path naming
 * nothing — a negative spec's missing file — says the same from anywhere.
 */
function rebased(text: string, from: string, to: string): string {
    const strings = literalSpans(text);
    let out = '';
    let last = 0;
    for (const found of text.matchAll(RELATIVE_LITERAL)) {
        const { lead = '', path = '', quote = "'" } = found.groups ?? {};
        const target = resolve(from, path);
        const inText = strings.some((span) => found.index > span.start && found.index < span.end);
        const isModule = /^(?:from|import)\b/u.test(lead);
        if (inText || (!isModule && !existsSync(target))) {
            continue;
        }
        const next =
            relativePath(to, target) + (path.endsWith('/') && !path.endsWith('../') ? '/' : '');
        out += `${text.slice(last, found.index)}${lead}${quote}${next.replace(/\/\/$/u, '/')}${quote}`;
        last = found.index + found[0].length;
    }
    return out + text.slice(last);
}

/** A top-level `describe(` call, opening at the start of its line. */
const DESCRIBE_CALL = /^describe(?:\.\w+(?:\([^()]*\))?)*\s*\(/gmu;

/** The top-level describes of a file, by the whole lines they take, and whether they hold a test. */
function describesOf(text: string): (Span & { holdsTests: boolean; open: number })[] {
    const blank = withoutComments(text);
    return [...blank.matchAll(DESCRIBE_CALL)].map((found) => {
        const open = found.index + found[0].length - 1;
        const close = closingOf(blank, open);
        const body = blank.slice(open, close);
        TEST_CALL.lastIndex = 0;
        return {
            end: lineEnd(text, close),
            holdsTests: TEST_CALL.test(body),
            open: lineEnd(text, blank.indexOf('{', open)),
            start: withLeadingComments(text, found.index),
        };
    });
}

/**
 * The code with ONE top-level describe, titled with the aspect: a describe
 * the cut left with no test goes, and the bodies of the others join the first
 * — C31's law, which a split would otherwise break on every file it writes.
 */
function oneDescribe(text: string, aspect: string): string {
    let current = text;
    for (const empty of describesOf(current)
        .filter((describe) => !describe.holdsTests)
        .toReversed()) {
        current = current.slice(0, empty.start) + current.slice(empty.end);
    }
    const describes = describesOf(current);
    const [first] = describes;
    if (first === undefined) {
        return current;
    }
    for (const later of describes.slice(1).toReversed()) {
        const closing = lineStart(current, later.end - 1);
        current =
            current.slice(0, later.start) +
            current.slice(later.open, closing) +
            current.slice(later.end);
    }
    if (describes.length > 1) {
        const firstClosing = lineStart(current, first.end - 1);
        const closing = current.slice(firstClosing, first.end);
        current = `${current.slice(0, firstClosing)}${current.slice(first.end).trimEnd()}\n${closing.trimEnd()}\n`;
    }
    return current.replace(
        /^describe\((?<quote>['"`])(?:[^\\]|\\.)*?\k<quote>/mu,
        `describe('${aspect}'`,
    );
}

/** The code with one test's lines taken out. */
function without(text: string, spans: Span[]): string {
    let current = text;
    for (const span of spans.toSorted((a, b) => b.start - a.start)) {
        current = current.slice(0, span.start) + current.slice(span.end);
    }
    return current;
}

/**
 * Every literal path of the specs tree, resolved: which file names which
 * target, so a moved entry's readers can be found and rewritten.
 */
function diskReferences(specsRoot: string): { file: string; target: string }[] {
    return listFiles(specsRoot, (path) => /\.(?:spec|test)\.tsx?$/u.test(path)).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(RELATIVE_LITERAL)]
            .filter(
                (found) =>
                    found.groups?.lead?.includes('from') !== true &&
                    found.groups?.lead?.includes('import') !== true,
            )
            .map((found) => ({ file, target: resolve(dirname(file), found.groups?.path ?? '.') })),
    );
}

/** Is `path` the entry, or below it? */
function isAtOrBelow(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry}${sep}`);
}

/**
 * The ground a moved or split spec leaves behind: every entry of the old
 * leaf's four folders a file of another leaf reads goes up to the specs
 * root's shared folder of its role, and every path that named it follows.
 */
function liftGround(specsRoot: string, leaf: string): string[] {
    const lifted: string[] = [];
    const references = diskReferences(specsRoot);
    for (const role of GROUND_DIRS) {
        const folder = join(leaf, role);
        if (treeKind(folder) !== 'directory') {
            continue;
        }
        for (const entry of treeEntries(folder)) {
            const path = join(folder, entry.name);
            const readers = references.filter(({ target }) => isAtOrBelow(path, target));
            if (readers.every(({ file }) => dirname(file) === leaf)) {
                continue;
            }
            const destination = join(specsRoot, SHARED_GROUND, role, entry.name);
            // The pool holds that name: C15 keeps reporting the reach.
            if (existsSync(destination)) {
                continue;
            }
            mkdirSync(dirname(destination), { recursive: true });
            moveKeepingHistory(path, destination);
            repointModuleTests(specsRoot, [{ copy: path, target: destination }]);
            for (const file of new Set(readers.map((reader) => reader.file))) {
                const text = readFileSync(file, 'utf8');
                const next = text.replaceAll(
                    relativePath(dirname(file), path),
                    relativePath(dirname(file), destination),
                );
                if (next !== text) {
                    writeFileSync(file, next);
                }
            }
            lifted.push(`${shown(specsRoot, path)} → ${shown(specsRoot, destination)}`);
        }
        if (readdirSync(folder).length === 0) {
            rmSync(folder, { recursive: true });
        }
    }
    forgetTree();
    return lifted;
}

// ── The helpers a split shares ──

/** One file a split writes: where, and its code, paths already rebased and pruned. */
type Draft = { target: string; text: string };

/** A call that builds a path — what a module no test is may never hold (C26). */
const BUILDS_DISK = /(?<![\w$.])(?:file|directory)\s*\(/u;

/** Does `code` read `name` — a whole identifier, never a member or a longer name? */
function reads(code: string, name: string): boolean {
    return new RegExp(
        String.raw`(?<![\w$.])${name.replaceAll('$', String.raw`\$`)}(?![\w$])`,
        'u',
    ).test(codeOnly(code));
}

/**
 * The file-level declarations a split moves into the leaf's fixtures module:
 * the values two files or more still read, with every declaration they read
 * in turn — a type alias or an interface among them — never one that builds a
 * `file()` or a `directory()` (C26), nor one that reads such a declaration,
 * which stay copied where they are read. A type only tests read is no helper:
 * it stays in each file that reads it.
 */
function movedDeclarations(spec: SpecRead, drafts: readonly Draft[]): Declaration[] {
    const declarations = declarationsOf(spec.text);
    const code = new Map(declarations.map((d) => [d.name, spec.text.slice(d.start, d.end)]));
    const readers = (name: string): number =>
        drafts.filter((draft) => declarationsOf(draft.text).some((d) => d.name === name)).length;
    const excluded = new Set(
        declarations
            .filter((d) => BUILDS_DISK.test(codeOnly(code.get(d.name) ?? '')))
            .map((d) => d.name),
    );
    const moved = new Set(
        declarations
            .filter((d) => !d.type && readers(d.name) > 1 && !excluded.has(d.name))
            .map((d) => d.name),
    );
    for (let changed = true; changed;) {
        changed = false;
        for (const name of moved) {
            const body = (code.get(name) ?? '').replace(
                new RegExp(String.raw`^[\s\S]*?\b${name.replaceAll('$', String.raw`\$`)}\b`, 'u'),
                '',
            );
            for (const other of declarations) {
                if (other.name === name || !reads(body, other.name)) {
                    continue;
                }
                if (excluded.has(other.name)) {
                    moved.delete(name);
                    excluded.add(name);
                    changed = true;
                    break;
                }
                if (!moved.has(other.name)) {
                    moved.add(other.name);
                    changed = true;
                }
            }
        }
    }
    return declarations.filter((d) => moved.has(d.name));
}

/** The folder every path of the list sits in or below — the nearest they share. */
function commonFolder(paths: readonly string[]): string {
    const [first = [], ...rest] = paths.map((path) => path.split(sep));
    let depth = first.length;
    for (const parts of rest) {
        depth = Math.min(depth, parts.length);
        while (depth > 0 && parts.slice(0, depth).join(sep) !== first.slice(0, depth).join(sep)) {
            depth -= 1;
        }
    }
    return first.slice(0, depth).join(sep);
}

/** A declaration's code, exported: `export` written before its head, its doc comment kept above. */
function exported(code: string): string {
    const head = /^(?:const|let|async\s|function|type\s|interface\s)/mu.exec(withoutComments(code));
    return head === null ? code : `${code.slice(0, head.index)}export ${code.slice(head.index)}`;
}

/** The code with an import line added after its last import. */
function withImportLine(text: string, line: string): string {
    const last = importsOf(text).at(-1);
    return last === undefined
        ? `${line}\n${text}`
        : `${text.slice(0, last.end)}${line}\n${text.slice(last.end)}`;
}

/**
 * The clause importing what a file reads from the fixtures module: `import
 * type` when it reads only types, a `type` before each type among values
 * otherwise, so no type becomes a runtime import.
 */
function importLine(read: readonly string[], types: ReadonlySet<string>, from: string): string {
    if (read.every((name) => types.has(name))) {
        return `import type { ${read.join(', ')} } from '${from}';`;
    }
    const names = read.map((name) => (types.has(name) ? `type ${name}` : name));
    return `import { ${names.join(', ')} } from '${from}';`;
}

/**
 * The drafts of a split once the helpers two of them read live once: moved
 * into the fixtures module of the folder their readers share,
 * `<folder>/<folder>.fixtures.ts`, exported, and imported by each reader —
 * the typed-fixture module the naming recap names, beside the tests it serves.
 * A module already at that path is the author's: the copies stay.
 */
function withSharedHelpers(spec: SpecRead, drafts: Draft[]): { drafts: Draft[]; fixtures?: Draft } {
    const moved = movedDeclarations(spec, drafts);
    if (moved.length === 0) {
        return { drafts };
    }
    const names = new Set(moved.map((d) => d.name));
    const types = new Set(moved.filter((d) => d.type).map((d) => d.name));
    const holds = (draft: Draft): boolean =>
        declarationsOf(draft.text).some((d) => names.has(d.name));
    const folder = commonFolder(drafts.filter(holds).map((draft) => dirname(draft.target)));
    const module = join(folder, `${basename(folder)}.fixtures.ts`);
    if (existsSync(module)) {
        return { drafts };
    }
    const imports = importsOf(spec.text)
        .map((clause) => spec.text.slice(clause.start, clause.end))
        .join('');
    const body = moved.map((d) => exported(spec.text.slice(d.start, d.end))).join('\n');
    const fixtures = {
        target: module,
        text: pruned(rebased(`${imports}\n${body}`, dirname(spec.file), folder)).replace(
            /^\n+/u,
            '',
        ),
    };
    return {
        drafts: drafts.map((draft) => {
            if (!holds(draft)) {
                return draft;
            }
            const kept = without(
                draft.text,
                declarationsOf(draft.text).filter((d) => names.has(d.name)),
            );
            const read = [...names].filter((name) => reads(kept, name)).toSorted();
            const specifier = relativePath(dirname(draft.target), module).replace(/\.ts$/u, '.js');
            return {
                target: draft.target,
                text: pruned(withImportLine(kept, importLine(read, types, specifier))),
            };
        }),
        fixtures,
    };
}

/** A hook call, opening its line — at the top level or in a describe's body. */
const HOOK_CALL = /^[ \t]*(?:afterAll|afterEach|beforeAll|beforeEach)\s*\(/gmu;

/** The names a hook's body may read that no test sets: the runner's own, and the language's. */
const AMBIENT = new Set([
    'afterAll',
    'afterEach',
    'async',
    'await',
    'beforeAll',
    'beforeEach',
    'console',
    'const',
    'expect',
    'false',
    'let',
    'new',
    'null',
    'process',
    'Promise',
    'return',
    'this',
    'true',
    'undefined',
    'vi',
]);

/** The names a piece of code reads — never a property after a dot, never a word inside a string. */
function namesRead(code: string): Set<string> {
    const bare = codeOnly(code);
    return new Set(
        [...bare.matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/gu)]
            .map((found) => found[0])
            .filter((name) => !AMBIENT.has(name)),
    );
}

/**
 * The code without the hooks nothing else in it reads the state of: a hook
 * whose names — the source it clears, the double it resets — the rest of the
 * file (its imports and the name's own declaration aside) never reads, went
 * with the tests that did. A hook reading nothing but the runner's names is
 * every test's, and stays.
 */
function withoutIdleHooks(text: string): string {
    const blank = withoutComments(text);
    const hooks = [...blank.matchAll(HOOK_CALL)].map((found) => {
        const open = found.index + found[0].length - 1;
        return {
            end: lineEnd(text, closingOf(blank, open)),
            start: withLeadingComments(text, found.index),
        };
    });
    const idle = hooks.filter((hook) => {
        const names = [...namesRead(text.slice(hook.start, hook.end))];
        const rest = without(text, [hook, ...importsOf(text)]);
        const declared = declarationsOf(rest);
        return (
            names.length > 0 &&
            names.every((name) => {
                const own = declared.find((d) => d.name === name) ?? { end: 0, start: 0 };
                return !isRead(rest, name, own);
            })
        );
    });
    return without(text, idle);
}

/** The files a split writes, one per subject: each with its tests, paths rebased, unread code pruned. */
function splitDrafts(spec: SpecRead, plan: Map<string, string>): Draft[] {
    const [first = ''] = openedSubjects(spec);
    const neutral = new Set(spec.tests.filter((test) => test.subjects.length === 0));
    return [...plan].map(([name, target]) => {
        const kept = new Set(
            spec.tests.filter(
                (test) => test.subjects[0] === name || (name === first && neutral.has(test)),
            ),
        );
        const cut = without(
            spec.text,
            spec.tests.filter((test) => !kept.has(test)),
        );
        const text = oneDescribe(withoutIdleHooks(cut), aspectOf(target));
        return { target, text: pruned(rebased(text, dirname(spec.file), dirname(target))) };
    });
}

/** Write a split's files, the helpers they share once, and the file's history with its first subject. */
function writeSplit(
    specsRoot: string,
    spec: SpecRead,
    keepsFile: boolean,
    drafts: Draft[],
): string[] {
    const shared = withSharedHelpers(spec, drafts);
    const [opening] = shared.drafts;
    if (opening !== undefined && !keepsFile && opening.target !== spec.file) {
        // The file's history follows its first subject.
        mkdirSync(dirname(opening.target), { recursive: true });
        moveKeepingHistory(spec.file, opening.target);
    }
    const written = [...shared.drafts, ...(shared.fixtures === undefined ? [] : [shared.fixtures])];
    for (const { target, text } of written) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text);
    }
    return written
        .filter(({ target }) => target !== spec.file)
        .map(({ target }) => `${shown(specsRoot, spec.file)} → ${shown(specsRoot, target)}`);
}

/**
 * Apply C29 and C30: split each spec reaching several subjects into one file
 * per subject, and move each spec about one subject to its standard folder.
 * A test reaching two subjects goes with the one its chain opens on, and C29
 * keeps naming it; a file whose target is taken is left for its author.
 * Returns what it did, below the specs root.
 */
export function fixSubjects(specsRoot: string): string[] {
    const done: string[] = [];
    for (const spec of subjectSpecs(specsRoot)) {
        if (spec.subjects.size === 0 || silenced(spec)) {
            continue;
        }
        const plan = splitPlan(specsRoot, spec);
        const targets = [...plan.values()];
        if (targets.every((target) => target === spec.file)) {
            continue;
        }
        if (targets.some((target) => target !== spec.file && existsSync(target))) {
            continue;
        }
        done.push(
            ...writeSplit(specsRoot, spec, targets.includes(spec.file), splitDrafts(spec, plan)),
        );
        forgetTree();
        done.push(...liftGround(specsRoot, dirname(spec.file)));
        removeEmptied(specsRoot, dirname(spec.file));
    }
    return done;
}

/**
 * Remove the folder a move left empty, and each parent it empties in turn, up
 * to the specs root — as C14 and C27 remove the folders theirs empty.
 */
function removeEmptied(specsRoot: string, folder: string): void {
    let current = folder;
    while (current !== specsRoot && current.startsWith(specsRoot) && existsSync(current)) {
        if (readdirSync(current).length > 0) {
            break;
        }
        rmSync(current, { recursive: true });
        current = dirname(current);
    }
    forgetTree();
}
