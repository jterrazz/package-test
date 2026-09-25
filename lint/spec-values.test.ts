import { describe, expect, test } from 'vitest';

import { kebabName, literalSpans, nameAround, titleAround } from './spec-values.js';

describe('spec-values', () => {
    test('spec values — what a fix names a value written in a test by — words become a kebab-case file name, punctuation and case dropped', () => {
        // Given - a comment, a title with a marker, words outside ASCII, nothing
        // Then - each spelling reads as one name
        expect(kebabName('Two users, one admin')).toBe('two-users-one-admin');
        expect(kebabName('  --lists the users!  ')).toBe('lists-the-users');
        expect(kebabName('ÉTÉ')).toBe('t');
        expect(kebabName('')).toBe('');
    });

    test('spec values — what a fix names a value written in a test by — a value is named by the title of the test around it, the innermost one', () => {
        // Given - a value inside a test, and one outside every test
        const text = [
            "const SHARED = 'x';",
            "test('lists the users', async () => {",
            "    await api.post('/users', { name: 'Ada' });",
            '});',
        ].join('\n');

        // Then - the one inside takes the title, the one outside the fallback
        expect(titleAround(text, text.indexOf('{ name'))).toBe('lists the users');
        expect(nameAround(text, text.indexOf('{ name'), 'value')).toBe('lists-the-users');
        expect(nameAround(text, text.indexOf("'x'"), 'value')).toBe('value');
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
});
