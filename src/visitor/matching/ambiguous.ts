import { refusal } from '../../chain/refusals/refusal.js';
import { asWritten, asWrittenUnscoped, FUNCTION_NAME_OF_KIND } from '../targets/as-written.js';
import type { Target } from '../targets/target.js';
import type { ElementMatch } from './candidates.js';
import { landmarkOfTagOrRole } from './landmark-of-tag.js';

/** A region is a landmark only when named, and a page holds several, so it is offered by name alone. */
function landmarkOf(match: ElementMatch): string | undefined {
    // Stryker disable next-line StringLiteral: no landmark is named by any text a mutant writes here either
    const kind = landmarkOfTagOrRole(match.context ?? '');
    if (kind !== 'region') {
        return kind === undefined ? undefined : `${FUNCTION_NAME_OF_KIND[kind]}()`;
    }
    return match.contextName === undefined
        ? undefined
        : `${FUNCTION_NAME_OF_KIND.region}(${JSON.stringify(match.contextName)})`;
}

function formatMatch(match: ElementMatch, index: number): string {
    const attribute = match.detail === undefined ? '' : ` ${quoteDetail(match)}`;
    const matchedOnLabel =
        match.accessibleName === undefined || match.accessibleName === ''
            ? ''
            : `  named ${JSON.stringify(match.accessibleName)}`;
    const context =
        match.context === undefined || match.context === '' ? '' : `  in <${match.context}>`;
    return `  ${index + 1}. <${match.tag}${attribute}>${match.text}</${match.tag}>${matchedOnLabel}${context}`;
}

function quoteDetail(match: ElementMatch): string {
    const attribute = match.tag === 'a' ? 'href' : 'name';
    return `${attribute}=${JSON.stringify(match.detail)}`;
}

function landmarkCounts(matches: ElementMatch[]): [string, number][] {
    const counts = new Map<string, number>();
    for (const match of matches) {
        const landmark = landmarkOf(match);
        if (landmark !== undefined) {
            counts.set(landmark, (counts.get(landmark) ?? 0) + 1);
        }
    }
    return [...counts].toSorted(([, a], [, b]) => a - b);
}

function formatFixes(target: Target, matches: ElementMatch[]): string[] {
    const fixes: string[] = [];

    const landmarksThatCutTheSet = landmarkCounts(matches).filter(
        ([, count]) => count < matches.length,
    );
    if (!target.scope) {
        const [first, ...rest] = landmarksThatCutTheSet;
        const alsoHere =
            rest.length > 0 ? `   [also here: ${rest.map(([name]) => name).join(', ')}]` : '';
        fixes.push(
            first === undefined
                ? `scope it       within(<a container holding only this one>, ${asWrittenUnscoped(target)})`
                : `scope it       within(${first[0]}, ${asWrittenUnscoped(target)})   [leaves ${first[1]} of ${matches.length}]${alsoHere}`,
        );
    }

    if (target.exact === false) {
        const remaining = matches.filter((match) => match.text === target.name).length;
        if (remaining > 0 && remaining < matches.length) {
            fixes.push(
                `exact name     ${asWrittenUnscoped({ ...target, exact: true })}` +
                    `   [leaves ${remaining} of ${matches.length}]`,
            );
        }
    }

    fixes.push(
        'other element  a heading(), button() or field() may name one thing where this does not',
    );
    return fixes;
}

export function ambiguityError(options: {
    target: Target;
    fixes: string[];
    lines: string[];
    where: string;
}): Error {
    const { target, fixes, lines, where } = options;
    return new Error(
        refusal('target-matches-one-element', {
            fix: ['designate one of them:', ...fixes.map((fix) => `  • ${fix}`)].join('\n'),
            found: [
                `Ambiguous element: ${asWritten(target)} matched ${lines.length} elements on ${where} —`,
                ...lines,
            ].join('\n'),
        }),
    );
}

export function ambiguousTargetError(options: {
    target: Target;
    matches: ElementMatch[];
    url: string;
}): Error {
    const { target, matches, url } = options;
    return ambiguityError({
        target,
        fixes: formatFixes(target, matches),
        lines: matches.map((match, index) => formatMatch(match, index)),
        where: url,
    });
}
