import { ambiguityError } from '../../../visitor/matching/ambiguous.js';
import { asWrittenUnscoped } from '../../../visitor/targets/as-written.js';
import type { Target } from '../../../visitor/targets/target.js';
import type { MobileElementMatch } from './device.port.js';

function formatMatch(match: MobileElementMatch, index: number): string {
    const label = match.label === undefined ? '' : ` ${JSON.stringify(match.label)}`;
    const value = match.value === undefined ? '' : `  value=${JSON.stringify(match.value)}`;
    const identifier = match.identifier === undefined ? '' : `  [testId: ${match.identifier}]`;
    return `  ${index + 1}. ${match.type}${label}${value}${identifier}`;
}

// invariant: `exact` is offered only to a target that opted out; distinct identifiers make `testId()` a concrete rewrite.
function formatFixes(target: Target, matches: MobileElementMatch[]): string[] {
    const fixes: string[] = [];

    if (!target.scope) {
        fixes.push(
            `scope it       within(testId('…'), ${asWrittenUnscoped(target)}) — a screen has no landmarks; any target works as the scope`,
        );
    }

    if (target.exact === false) {
        const remaining = matches.filter((match) => match.label === target.name).length;
        if (remaining > 0 && remaining < matches.length) {
            fixes.push(
                `exact name     ${asWrittenUnscoped({ ...target, exact: true })}` +
                    `   [leaves ${remaining} of ${matches.length}]`,
            );
        }
    }

    const identifiers = [
        ...new Set(
            matches
                .map((match) => match.identifier)
                .filter((identifier): identifier is string => identifier !== undefined),
        ),
    ];
    if (identifiers.length > 1 && target.kind !== 'testId') {
        fixes.push(
            `test id        testId(${JSON.stringify(identifiers[0])})   [also here: ${identifiers
                .slice(1)
                .join(', ')}]`,
        );
    }

    fixes.push('other element  a button() or field() may name one thing where this does not');
    return fixes;
}

export function ambiguousScreenElementError(options: {
    target: Target;
    matches: MobileElementMatch[];
}): Error {
    const { target, matches } = options;
    return ambiguityError({
        target,
        fixes: formatFixes(target, matches),
        lines: matches.map((match, index) => formatMatch(match, index)),
        where: 'the screen',
    });
}
