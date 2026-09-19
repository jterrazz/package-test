import { describe, expect, test } from 'vitest';

import { nativeContain, nativeMatch } from './text-assertions.js';

/**
 * The framework overrides `toMatch` and `toContain` GLOBALLY, in two builds. A
 * subject it does not own has to keep meaning what vitest's own matcher meant,
 * identically on both sides of the browser seam — so the fallback is specified
 * here, once, rather than twice by hand.
 */

describe('nativeContain', () => {
    test('asks an iterable for membership, never for a substring of its rendering', () => {
        // Given - an array whose joined text contains a fragment no element is
        // Then - membership is the question, and `'b'` is not a member
        expect(nativeContain(['ab', 'cd'], 'b').pass).toBe(false);
        expect(nativeContain(['ab', 'cd'], 'ab').pass).toBe(true);
    });

    test('reads a Set the way vitest does', () => {
        // Given - a collection that is iterable but has no indices
        // Then - its members answer
        expect(nativeContain(new Set([1]), 1).pass).toBe(true);
        expect(nativeContain(new Set([1]), 2).pass).toBe(false);
    });

    test('is a substring test on a string, as it always was', () => {
        // Given - a plain string subject
        // Then - the substring answers
        expect(nativeContain('hexagonal', 'agon').pass).toBe(true);
    });

    test('refuses a subject that is neither', () => {
        // Given - a number, which has no members and no characters
        // Then - the refusal names what it expected
        expect(() => nativeContain(42, '4')).toThrow(/stream accessor, string, or iterable/u);
    });
});

describe('nativeMatch', () => {
    test('takes a substring or a regular expression on a string', () => {
        // Given - the two shapes vitest's own toMatch accepts
        // Then - both answer the same way they do without the override
        expect(nativeMatch('hexagonal', 'agon').pass).toBe(true);
        expect(nativeMatch('hexagonal', /^hex/u).pass).toBe(true);
        expect(nativeMatch('hexagonal', /^agon/u).pass).toBe(false);
    });

    test('refuses a subject that is not a string, rather than stringifying it', () => {
        // Given - an object, which has no text of its own worth matching
        // Then - the refusal names the accessors and the string it expected
        expect(() => nativeMatch({ a: 1 }, 'a')).toThrow(/unsupported subject/u);
    });
});
