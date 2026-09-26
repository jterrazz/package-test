import { relative } from 'node:path';

import { listFiles, readText } from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

const DIRECTIVE = /(?<lead>.*?)checker-disable(?:-next-line|-line)\s+(?<rest>.*)$/iu;

/** Only in a comment: the word inside a string is a test talking about suppressions. */
const COMMENT_LEAD = /(?:^|\s)(?:\/\/|\/\*|\*|#)\s*$/u;

const READABLE = /\.(?:[cm]?[jt]sx?|ya?ml|json|md|sql|http|txt)$/u;

function isReadableText(path: string): boolean {
    return READABLE.test(path);
}

function idOf(rest: string | undefined): string {
    const ids = rest?.trim() ?? '';
    return ids === '' ? '<id>' : ids;
}

const REASON = /--\s*\S/u;

/** The toolchain's `suppressions-reason` gate reads `oxlint-disable*` only, so this channel carries its own. */
export function checkCheckerSuppressionStatesAReason(rootDir: string): Finding[] {
    const violations: Finding[] = [];
    for (const file of listFiles(rootDir, isReadableText)) {
        const text = readText(file);
        if (!text.includes('checker-disable')) {
            continue;
        }
        for (const [index, line] of text.split('\n').entries()) {
            const match = DIRECTIVE.exec(line);
            if (
                match === null ||
                !COMMENT_LEAD.test(match.groups?.lead ?? '') ||
                REASON.test(match.groups?.rest ?? '')
            ) {
                continue;
            }
            const rel = relative(rootDir, file);
            violations.push({
                file: rel,
                line: index + 1,
                fix: `end the directive with its reason: \`checker-disable-next-line ${idOf(match.groups?.rest)} -- <why this line is the exception>\``,
                found: 'a checker suppression that does not say why',
                rule: 'checker-suppression-states-a-reason',
                severity: 'error',
            });
        }
    }
    return violations;
}
