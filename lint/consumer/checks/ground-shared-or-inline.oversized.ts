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
} from './ground-shared-or-inline.forms.js';

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

const STRING_SUBJECT = /\.(?:text|raw)\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

/** vitest's own `toMatch` takes no file: its long value is reported, never written to one. */
const PLAIN_SUBJECT =
    /expect\s*\(\s*(?<subject>[A-Za-z_$][\w$]*|'[^'\n]*'|"[^"\n]*")\s*\)\s*\.(?:not\s*\.\s*)?toMatch\s*\($/u;

function literalValue(source: string): unknown {
    if (/\$\{/u.test(source)) {
        return undefined;
    }
    try {
        return runInNewContext(`(${source})`, {}, { timeout: 1000 });
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
    const argument = argumentSpans(text, open + 1, closingOf(text, open))[
        verb === 'post' || verb === 'put' ? 1 : 0
    ];
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

export function oversizedValues(rootDir: string): Oversized[] {
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

export function capFinding(rootDir: string, oversized: Oversized): Spotted {
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

export function fixOversizedValues(rootDir: string): string[] {
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
