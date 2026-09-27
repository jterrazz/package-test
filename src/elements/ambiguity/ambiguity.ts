import { refusal } from '../../../lint/index.refusal.js';
import { asWritten, asWrittenUnscoped, FUNCTION_NAME_OF_KIND } from '../descriptors/as-written.js';
import type { ElementRef } from '../descriptors/element.js';
import { landmarkOfTagOrRole } from './landmark-of-tag.js';

/** One candidate of an ambiguous descriptor, as the refusal lists it. */
export type ElementMatch = {
    /** The accessible name, when it differs from the text (an `aria-label`). */
    accessibleName?: string | undefined;
    /** Nearest landmark ancestor (`nav`, `footer`, `main`…), when there is one. */
    context?: string | undefined;
    /** That landmark's accessible name. */
    contextName?: string | undefined;
    /** The attribute that disambiguates most — `href` for links, `name` for fields. */
    detail?: string | undefined;
    /** Tag name, lower-cased. */
    tag: string;
    /** Text content, whitespace-collapsed and truncated. */
    text: string;
};

/** A region is a landmark only when named, and a page holds several, so it is offered by name alone. */
function landmarkOf(match: ElementMatch): string | undefined {
    const kind = match.context === undefined ? undefined : landmarkOfTagOrRole(match.context);
    if (kind !== 'region') {
        return kind === undefined ? undefined : `${FUNCTION_NAME_OF_KIND[kind]}()`;
    }
    return match.contextName === undefined
        ? undefined
        : `${FUNCTION_NAME_OF_KIND.region}(${JSON.stringify(match.contextName)})`;
}

function formatMatch(match: ElementMatch, index: number): string {
    const attribute = match.detail ? ` ${quoteDetail(match)}` : '';
    // The accessible name is what a role descriptor matched on: when it is an `aria-label`, the text alone names the wrong thing.
    const named = match.accessibleName ? `  named ${JSON.stringify(match.accessibleName)}` : '';
    const context = match.context ? `  in <${match.context}>` : '';
    return `  ${index + 1}. <${match.tag}${attribute}>${match.text}</${match.tag}>${named}${context}`;
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

function formatFixes(element: ElementRef, matches: ElementMatch[]): string[] {
    const fixes: string[] = [];

    // A landmark holding every candidate narrows nothing: only the ones that cut the set are offered.
    const narrowing = landmarkCounts(matches).filter(([, count]) => count < matches.length);
    if (!element.scope) {
        const [first, ...rest] = narrowing;
        const alsoHere =
            rest.length > 0 ? `   [also here: ${rest.map(([name]) => name).join(', ')}]` : '';
        fixes.push(
            first === undefined
                ? `scope it       within(<a container holding only this one>, ${asWrittenUnscoped(element)})`
                : `scope it       within(${first[0]}, ${asWrittenUnscoped(element)})   [leaves ${first[1]} of ${matches.length}]${alsoHere}`,
        );
    }

    // Only for a descriptor that opted out: exact is the default.
    if (element.exact === false && element.name !== undefined) {
        const remaining = matches.filter((match) => match.text === element.name).length;
        if (remaining > 0 && remaining < matches.length) {
            fixes.push(
                `exact name     ${asWrittenUnscoped({ ...element, exact: true })}` +
                    `   [leaves ${remaining} of ${matches.length}]`,
            );
        }
    }

    fixes.push(
        'other element  a heading(), button() or field() may name one thing where this does not',
    );
    return fixes;
}

/** A distinct class so the visit wrapper lets the complete message through instead of nesting it. */
export class AmbiguousElementError extends Error {
    override readonly name = 'AmbiguousElementError';
}

export function describeAmbiguity(options: {
    element: ElementRef;
    matches: ElementMatch[];
    url: string;
}): string {
    const { element, matches, url } = options;
    const fixes = formatFixes(element, matches).map((fix) => `  • ${fix}`);

    return refusal('descriptor-matches-one-element', {
        fix: ['designate one of them:', ...fixes].join('\n'),
        found: [
            `Ambiguous element: ${asWritten(element)} matched ${matches.length} elements on ${url} —`,
            ...matches.map((match, index) => formatMatch(match, index)),
        ].join('\n'),
    });
}
