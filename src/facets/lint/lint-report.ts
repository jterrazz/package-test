import { LESSON_PARTS, lessonParts } from '@jterrazz/typescript/rules';
import type { Finding } from '@jterrazz/typescript/rules';

import { refusal } from '../../../lint/index.refusal.js';

export type Diagnostic = { at: string; message: string; rule: string };

const OXLINT_UNIX_LINE =
    /^(?<at>\S+?:\d+:\d+): (?<message>.*) \[(?:Error|Warning)\/(?<rule>[\w-]+\([^)\]]+\))\]$/u;

const COMPILER_LINE =
    /^(?<at>\S+?:\d+:\d+): (?:error|warning) (?<rule>[\w-]+\([^)]+\)): (?<message>.*)$/u;

const OXLINT_GRAPHICAL_HEAD = /^\s+[!x] [\w-]+\([^)]+\): /u;

const POSITIONED = /:\d+:\d+$/u;

const INDENT = '    ';

export function diagnosticsOf(text: string): Diagnostic[] {
    const graphical = text.split('\n').find((line) => OXLINT_GRAPHICAL_HEAD.test(line));
    if (graphical !== undefined) {
        throw new Error(
            refusal({
                fix: 'run oxlint with --format=unix or --format=agent: without it, oxlint picks its renderer off the environment',
                found: `a report in oxlint's graphical rendering (${graphical.trim()})`,
                read: 'docs/21-lint.md#the-report',
                why: 'A report is read one line per diagnostic.',
            }),
        );
    }
    return text.split('\n').flatMap((line) => {
        const found = (OXLINT_UNIX_LINE.exec(line) ?? COMPILER_LINE.exec(line))?.groups;
        return found === undefined
            ? []
            : [{ at: found.at ?? '', message: found.message ?? '', rule: found.rule ?? '' }];
    });
}

export function presetDiagnostic({ message, path, rule }: Finding): Diagnostic {
    const [pass = '', ...name] = rule.split('/');
    return {
        at: POSITIONED.test(path) ? path : `${path}:1:1`,
        message,
        rule: `${pass}(${name.join('/')})`,
    };
}

function positionOf({ at }: Diagnostic): [string, number, number] {
    const [column = '0', row = '0', ...file] = at.split(':').toReversed();
    return [file.toReversed().join(':'), Number(row), Number(column)];
}

function byPosition(a: Diagnostic, b: Diagnostic): number {
    const [fileA, rowA, columnA] = positionOf(a);
    const [fileB, rowB, columnB] = positionOf(b);
    if (fileA !== fileB) {
        return fileA < fileB ? -1 : 1;
    }
    if (rowA !== rowB || columnA !== columnB) {
        return rowA === rowB ? columnA - columnB : rowA - rowB;
    }
    const [textA, textB] = [`${a.rule} ${a.message}`, `${b.rule} ${b.message}`];
    return textA < textB ? -1 : Number(textA > textB);
}

function messageLines(message: string): string[] {
    const parts = lessonParts(message);
    if (parts?.found === undefined) {
        return [`${INDENT}${message}`];
    }
    return LESSON_PARTS.flatMap((part) =>
        parts[part] === undefined ? [] : [`${INDENT}${part}: ${parts[part]}`],
    );
}

export function lintReport(diagnostics: readonly Diagnostic[]): string {
    const lines: string[] = [];
    for (const diagnostic of diagnostics.toSorted(byPosition)) {
        lines.push(`${diagnostic.at}  ${diagnostic.rule}`, ...messageLines(diagnostic.message));
    }
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}
