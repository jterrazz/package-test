import {
    blankComments,
    forgetTree,
    GROUND_EXPECTED,
    GROUND_REQUESTS,
} from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { runInNewContext } from 'node:vm';

import { withEntryImport } from '../../kit/checker/entry-import.js';
import { dedent } from '../../kit/project/dedent.js';
import { argumentSpans, closingOf } from '../../kit/project/source-scan.js';
import { isInside, literalSpans, nameAround } from '../../kit/project/spec-values.js';
import type { Span } from '../../kit/project/spec-values.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { findSpecsRoots, listFiles } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';
import {
    INLINE_CAPS,
    JSON_SUBJECT,
    TEST_FILE,
    valueLines,
    written,
} from './ground-shared-or-inline.forms.js';

type FileForm = { extension: string; text: string };

type Oversized = {
    column: number;
    end: number;
    file: string;
    /** `undefined` when no file form holds it. */
    form: FileForm | undefined;
    line: number;
    lines: number;
    name: string;
    role: string;
    start: number;
    /** A string has no golden, so the value stays in place. */
    subject: string | undefined;
};

const VALUE_CALL = /\.(?<verb>post|put|request|toMatch)\s*\(/gu;

const VALUE_START = /^[`'"{[]/u;

const STRING_SUBJECT = /\.(?:text|raw)\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

/** vitest's own `toMatch` takes no file: its long value is reported, never written to one. */
const RESPONSE_SUBJECT = /\.response\)\s*\.(?:not\.)?toMatch\($/u;

const PLAIN_SUBJECT =
    /expect\s*\(\s*(?<subject>[A-Za-z_$][\w$]*|'[^'\n]*'|"[^"\n]*")\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

// Stryker disable BlockStatement: a catch emptied returns undefined all the same
function literalValue(source: string): unknown {
    try {
        // Stryker disable next-line ObjectLiteral: the bound only matters for a value that never finishes evaluating
        return runInNewContext(`(${source})`, {}, { timeout: 1000 });
    } catch {
        return undefined;
    }
}
// Stryker restore BlockStatement

function fileForm(verb: string, before: string, stated: unknown): FileForm | undefined {
    if (typeof stated === 'string') {
        if (verb === 'post' || verb === 'put') {
            return { extension: '.txt', text: stated };
        }
        const http = verb === 'request' || RESPONSE_SUBJECT.test(before);
        return { extension: http ? '.http' : '.txt', text: dedent(stated) };
    }
    if (typeof stated !== 'object' || (verb === 'toMatch' && !JSON_SUBJECT.test(before))) {
        return undefined;
    }
    return { extension: '.json', text: `${JSON.stringify(stated, null, 4)}\n` };
}

type Candidate = Span & { before: string; role: string; source: string; verb: string };

function candidateAt(
    text: string,
    call: RegExpExecArray,
    literals: readonly Span[],
): Candidate | undefined {
    // Stryker disable next-line StringLiteral: a call match always carries its verb
    const { verb = '' } = call.groups ?? {};
    const open = call.index + call[0].length - 1;
    const before = text.slice(0, open + 1);
    if (isInside(literals, call.index) || STRING_SUBJECT.test(before)) {
        return undefined;
    }
    const argument = argumentSpans(text, open + 1, closingOf(text, open))[
        verb === 'post' || verb === 'put' ? 1 : 0
    ];
    if (argument === undefined) {
        return undefined;
    }
    const source = text.slice(argument.start, argument.end);
    if (!VALUE_START.test(source)) {
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
        const { subject } = PLAIN_SUBJECT.exec(candidate.before)?.groups ?? {};
        const form =
            subject === undefined
                ? fileForm(candidate.verb, candidate.before, literalValue(candidate.source))
                : undefined;
        const lines = valueLines(form?.text ?? candidate.source);
        const position = text.slice(0, candidate.start);
        const line = position.split('\n').length;
        if (lines <= (INLINE_CAPS[candidate.role] ?? lines) || suppressed.has(line)) {
            return [];
        }
        return [
            {
                column: candidate.start - position.lastIndexOf('\n'),
                end: candidate.end,
                file,
                form,
                line,
                lines,
                name: nameAround(text, candidate.start, candidate.role),
                role: candidate.role,
                start: candidate.start,
                subject,
            },
        ];
    });
}

export function oversizedValues(rootDir: string): Oversized[] {
    return findSpecsRoots(rootDir).flatMap((root) =>
        listFiles(root, (path) => TEST_FILE.test(path)).flatMap((file) => oversizedIn(file)),
    );
}

/** Its own bytes are reused; another's are skipped past with a suffix. */
function freePath(file: string, role: string, name: string, form: FileForm): string {
    const folder = join(dirname(file), role);
    for (let suffix = 1; ; suffix += 1) {
        const path = join(folder, `${name}${suffix === 1 ? '' : `-${suffix}`}${form.extension}`);
        if (!existsSync(path) || readFileSync(path, 'utf8') === form.text) {
            return path;
        }
    }
}

function capFix(oversized: Oversized): string {
    if (oversized.subject !== undefined) {
        return `a string has no golden: wrap it — \`expect(text(${oversized.subject})).toMatch(file('./${oversized.role}/${oversized.name}.txt'))\` — or compare the result it came from to its file; by hand: the fixer never writes a string's comparison to a file`;
    }
    if (oversized.form === undefined) {
        return `move it to a file under ./${oversized.role}/ and name it with file() — by hand: the fixer reads a string, a template or a JSON value only`;
    }
    const target = `./${oversized.role}/${oversized.name}${oversized.form.extension}`;
    return `move it to ${target} and name it with file('${target}') — \`typescript fix\` moves it`;
}

export function capFinding(rootDir: string, oversized: Oversized): Spotted {
    const kind = oversized.role === GROUND_EXPECTED ? 'an expectation' : 'a request';
    return {
        column: oversized.column,
        path: relative(rootDir, oversized.file),
        fix: capFix(oversized),
        found: `${kind} of ${oversized.lines} lines written in the test, past the ${oversized.role}/ cap of ${INLINE_CAPS[oversized.role] ?? 0}`,
        line: oversized.line,
        rule: 'ground-shared-or-inline',
    };
}

export function fixOversizedValues(rootDir: string): string[] {
    const done: string[] = [];
    const movable = oversizedValues(rootDir).flatMap(({ form, ...oversized }) =>
        form === undefined ? [] : [{ form, oversized }],
    );
    const byFile = Map.groupBy(movable, ({ oversized }) => oversized.file);
    for (const [file, values] of byFile) {
        // Stryker disable next-line StringLiteral: a Buffer spliced into a template reads as the same UTF-8 text
        let text = readFileSync(file, 'utf8');
        for (const { form, oversized } of values.toSorted(
            (a, b) => b.oversized.start - a.oversized.start,
        )) {
            const path = freePath(file, oversized.role, oversized.name, form);
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, form.text);
            text = `${text.slice(0, oversized.start)}file('./${written(file, path)}')${text.slice(oversized.end)}`;
            done.push(`${relative(rootDir, file)}:${oversized.line} → ${relative(rootDir, path)}`);
        }
        writeFileSync(file, withEntryImport(text, file, 'file'));
    }
    // Stryker disable next-line CallExpression: outside a git work tree the walk reads the disk afresh
    forgetTree();
    return done;
}
