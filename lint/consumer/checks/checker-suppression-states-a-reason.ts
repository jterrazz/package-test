import { relative } from 'node:path';

import { directivesIn, holdsDirectives } from '../../engine/project/suppression.js';
import { listFiles, readText } from '../../engine/project/tree.js';
import type { Spotted } from './checker.js';

function idOf(rest: string): string {
    const ids = rest.trim();
    return ids === '' ? '<id>' : ids;
}

const REASON = /--\s*\S/u;

/** The toolchain's `suppressions-reason` gate reads `oxlint-disable*` only, so this channel carries its own. */
export function checkCheckerSuppressionStatesAReason(rootDir: string): Spotted[] {
    const violations: Spotted[] = [];
    for (const file of listFiles(rootDir, holdsDirectives)) {
        const text = readText(file);
        if (!text.includes('checker-disable')) {
            continue;
        }
        for (const { line, rest } of directivesIn(text)) {
            if (REASON.test(rest)) {
                continue;
            }
            violations.push({
                path: relative(rootDir, file),
                line,
                fix: `end the directive with its reason: \`checker-disable-next-line ${idOf(rest)} -- <why this line is the exception>\``,
                found: 'a checker suppression that does not say why',
                rule: 'checker-suppression-states-a-reason',
            });
        }
    }
    return violations;
}
