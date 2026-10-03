import { relative } from 'node:path';

import { directivesIn, holdsDirectives } from '../../kit/project/suppression.js';
import { listFiles, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

const EVERY_PASS = '*';

export function checkCheckerSuppressionNamesAPass(
    rootDir: string,
    passIds: readonly string[],
): Spotted[] {
    const known = new Set([...passIds, EVERY_PASS]);
    const violations: Spotted[] = [];
    for (const file of listFiles(rootDir, holdsDirectives)) {
        const text = readText(file);
        if (!text.includes('checker-disable')) {
            continue;
        }
        for (const { ids, line } of directivesIn(text)) {
            for (const id of ids.filter((named) => !known.has(named))) {
                violations.push({
                    path: relative(rootDir, file),
                    line,
                    fix: `name the pass this line is the exception to, or delete the directive — \`${id}\` silences nothing`,
                    found: `a checker suppression naming \`${id}\`, which no pass of the checker has`,
                    rule: 'checker-suppression-names-a-pass',
                });
            }
        }
    }
    return violations;
}
