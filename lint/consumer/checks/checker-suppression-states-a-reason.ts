import { directivesUnder } from '../../kit/project/suppression.js';
import type { Spotted } from './checker.js';

const REASON = /--\s*\S/u;

/** The toolchain's `suppressions-reason` gate reads `oxlint-disable*` only, so this channel carries its own. */
export function checkCheckerSuppressionStatesAReason(rootDir: string): Spotted[] {
    return directivesUnder(rootDir)
        .filter(({ rest }) => !REASON.test(rest))
        .map(({ ids, line, path }) => ({
            path,
            line,
            fix: `end the directive with its reason: \`checker-disable-next-line ${ids.length === 0 ? '<id>' : ids.join(', ')} -- <why this line is the exception>\``,
            found: 'a checker suppression that does not say why',
            rule: 'checker-suppression-states-a-reason',
        }));
}
