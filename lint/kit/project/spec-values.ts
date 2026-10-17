import { closingOf, literalEnd } from './source-scan.js';

export type Span = { end: number; start: number };

const TITLED_TEST =
    /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(\s*(?<quote>['"`])(?<title>(?:[^\\]|\\.)*?)\k<quote>/gu;

/** `Two users, one admin` gives `two-users-one-admin`. */
export function kebabName(words: string): string {
    return words
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-|-$/gu, '');
}

export function literalSpans(text: string): Span[] {
    const spans: Span[] = [];
    // Stryker disable next-line EqualityOperator: past the text's end no literal opens
    for (let index = 0; index < text.length;) {
        const end = literalEnd(text, index);
        if (end === index) {
            index += 1;
        } else {
            spans.push({ end, start: index });
            index = end;
        }
    }
    return spans;
}

export function isInside(spans: readonly Span[], index: number): boolean {
    return spans.some((span) => index >= span.start && index < span.end);
}

export function titleAround(text: string, index: number): string | undefined {
    let title: string | undefined;
    for (const found of text.matchAll(TITLED_TEST)) {
        // Stryker disable next-line EqualityOperator: a value never starts where a test call does
        if (found.index > index) {
            break;
        }
        // Stryker disable next-line OptionalChaining,StringLiteral: a match always carries its named group
        const written = found.groups?.title ?? '';
        // invariant: the call's own parenthesis is the last before its title, past any `.each(...)` table.
        const call = text.lastIndexOf('(', found.index + found[0].length - written.length - 2);
        // Stryker disable next-line EqualityOperator: a value never starts on a test's closing parenthesis
        if (closingOf(text, call) > index) {
            title = written;
        }
    }
    return title;
}

export function nameAround(text: string, index: number, fallback: string): string {
    const name = kebabName(titleAround(text, index) ?? '');
    return name === '' ? fallback : name;
}
