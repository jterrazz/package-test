import { closingOf, literalEnd } from './source-scan.js';

export type Span = { end: number; start: number };

const TITLED_TEST =
    /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(\s*(?<quote>['"`])(?<title>(?:[^\\]|\\.)*?)\k<quote>/gu;

/** `Two users, one admin` → `two-users-one-admin`. */
export function kebabName(words: string): string {
    return words
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-+|-+$/gu, '');
}

export function literalSpans(text: string): Span[] {
    const spans: Span[] = [];
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
        if (found.index > index) {
            break;
        }
        if (closingOf(text, text.indexOf('(', found.index)) > index) {
            title = found.groups?.title;
        }
    }
    return title;
}

export function nameAround(text: string, index: number, fallback: string): string {
    const name = kebabName(titleAround(text, index) ?? '');
    return name === '' ? fallback : name;
}
