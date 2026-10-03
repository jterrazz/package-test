import { directivesUnder } from '../../kit/project/suppression.js';
import type { Spotted } from './checker.js';

const EVERY_PASS = '*';

export function checkCheckerSuppressionNamesAPass(
    rootDir: string,
    passIds: readonly string[],
): Spotted[] {
    const known = new Set([...passIds, EVERY_PASS]);
    return directivesUnder(rootDir).flatMap(({ ids, line, path }) =>
        ids
            .filter((id) => !known.has(id))
            .map((id) => ({
                path,
                line,
                fix: `name the pass this line is the exception to, or delete the directive — \`${id}\` silences nothing`,
                found: `a checker suppression naming \`${id}\`, which no pass of the checker has`,
                rule: 'checker-suppression-names-a-pass',
            })),
    );
}
