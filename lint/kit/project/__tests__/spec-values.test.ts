import { describe, expect, test } from 'vitest';

import { isInside, kebabName, literalSpans, nameAround, titleAround } from '../spec-values.js';

describe('spec-values', () => {
    test('spec values — what a fix names a value written in a test by — words become a kebab-case file name, punctuation and case dropped', () => {
        // Given - a comment, a title with a marker, words outside ASCII, nothing
        // Then - each spelling reads as one name
        expect(kebabName('Two users, one admin')).toBe('two-users-one-admin');
        expect(kebabName('  --lists the users!  ')).toBe('lists-the-users');
        expect(kebabName('ÉTÉ')).toBe('t');
        expect(kebabName('')).toBe('');
        expect(kebabName('a - b')).toBe('a-b');
    });

    test('spec values — what a fix names a value written in a test by — a value is named by the title of the test around it, the innermost one', () => {
        // Given - a value inside a test, one outside every test, one after a test, and one inside a parameterised test's callback
        const text = [
            "const SHARED = 'x';",
            "test('lists the users', async () => {",
            "    await api.post('/users', { name: 'Ada' });",
            '});',
            "const AFTER = 'y';",
            "test('(a) reads', () => { read({ at: 'r' }); });",
            "test.each([1, 2])('pages %s', async () => {",
            "    await api.get('/users', { page: 'p' });",
            '});',
        ].join('\n');

        // Then - the one inside takes the title, the one outside the fallback
        expect(titleAround(text, text.indexOf('{ name'))).toBe('lists the users');
        expect(
            ['{ name', "'x'", "'y'", '{ page', '{ at'].map((value) =>
                nameAround(text, text.indexOf(value), 'value'),
            ),
        ).toStrictEqual(['lists-the-users', 'value', 'value', 'pages-s', 'a-reads']);
    });

    test('spec values — what a fix names a value written in a test by — a call spelled in a string is text, never code', () => {
        // Given - a string holding a call
        const text = "const code = \"api.post('/x', {})\"; api.get('/y');";

        // Then - the string is one span, the code after it is outside every span
        expect(literalSpans(text).map(({ end, start }) => text.slice(start, end))).toStrictEqual([
            '"api.post(\'/x\', {})"',
            "'/y'",
        ]);
    });

    test('spec values — a position is inside a span from its start up to, not at, its end', () => {
        // Given - two spans
        const spans = [
            { end: 5, start: 2 },
            { end: 9, start: 7 },
        ];

        // Then - each position against both
        expect([1, 2, 4, 5, 7].map((index) => isInside(spans, index))).toStrictEqual([
            false,
            true,
            true,
            false,
            true,
        ]);
    });
});
