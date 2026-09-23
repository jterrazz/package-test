import { closingOf, literalEnd } from './subject.js';

/**
 * What the checker's fixes read of a value a spec writes in place, to give it
 * a file: where the spec's strings stand, the test a value sits in, and the
 * name a file takes from words.
 */

/** A source span, by offsets. */
export type Span = { end: number; start: number };

/** The start of a test's call, and the title it opens on. */
const TITLED_TEST =
    /(?<![.\w$])(?:test|it)(?:\.\w+(?:\([^()]*\))?)*\s*\(\s*(?<quote>['"`])(?<title>(?:[^\\]|\\.)*?)\k<quote>/gu;

/** Words as a file name: `Two users, one admin` → `two-users-one-admin`. */
export function kebabName(words: string): string {
    return words
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-+|-+$/gu, '');
}

/** The spans of a source's strings, templates and regular expressions. */
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

/** Is `index` inside one of the spans? */
export function isInside(spans: readonly Span[], index: number): boolean {
    return spans.some((span) => index >= span.start && index < span.end);
}

/** The title of the test whose call holds `index`, if one does. */
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

/** The name a value's file takes from the test around it — `fallback` outside every test. */
export function nameAround(text: string, index: number, fallback: string): string {
    const name = kebabName(titleAround(text, index) ?? '');
    return name === '' ? fallback : name;
}
