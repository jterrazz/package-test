import { describe, expect, test } from 'vitest';

import { file } from '../chain/spec-path.js';
import { GOLDEN_MATCHER, matchThroughGolden, nativeContain } from './text-assertions.js';

/**
 * The framework overrides `toContain` GLOBALLY, in two builds, and routes
 * `toMatch`'s disk arguments to the golden. A subject it does not own has to
 * keep meaning what vitest's own matcher meant, identically on both sides of
 * the browser seam — so the fallback is specified here, once, rather than
 * twice by hand.
 */

describe('nativeContain', () => {
    test('asks an iterable for membership, never for a substring of its rendering', () => {
        // Given - an array whose joined text contains a fragment no element is
        // Then - membership is the question, and `'b'` is not a member
        expect(nativeContain(['ab', 'cd'], 'b').pass).toBeFalsy();
        expect(nativeContain(['ab', 'cd'], 'ab').pass).toBeTruthy();
    });

    test('reads a Set the way vitest does', () => {
        // Given - a collection that is iterable but has no indices
        // Then - its members answer
        expect(nativeContain(new Set([1]), 1).pass).toBeTruthy();
        expect(nativeContain(new Set([1]), 2).pass).toBeFalsy();
    });

    test('is a substring test on a string, as it always was', () => {
        // Given - a plain string subject
        // Then - the substring answers
        expect(nativeContain('hexagonal', 'agon').pass).toBeTruthy();
    });

    test('refuses a subject that is neither', () => {
        // Given - a number, which has no members and no characters
        // Then - the refusal names what it expected
        expect(() => nativeContain(42, '4')).toThrow(/stream accessor, string, or iterable/u);
    });
});

/** A chai whose `toMatch` records who answered. */
/** What `overwriteMethod` is handed: the original, and the method that replaces it. */
type Overwrite = (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;
function chaiWith(answered: string[]): {
    Assertion: { prototype: Record<string, unknown> };
    util: { overwriteMethod: (target: object, name: string, method: Overwrite) => void };
} {
    const prototype: Record<string, unknown> = {
        [GOLDEN_MATCHER]: () => answered.push('golden'),
        toMatch: () => answered.push('vitest'),
    };
    return {
        Assertion: { prototype },
        util: {
            overwriteMethod: (target, name, method) => {
                const record = target as Record<string, (...args: unknown[]) => unknown>;
                const original = record[name];
                if (original !== undefined) {
                    record[name] = method(original);
                }
            },
        },
    };
}

describe('matchThroughGolden', () => {
    /** A chai whose `toMatch` records who answered. */
    test('hands the disk to the golden and every value to vitest, untouched', () => {
        // Given - a chai whose two answers are recorded
        const answered: string[] = [];
        const chai = chaiWith(answered);
        matchThroughGolden(chai);
        const toMatch = chai.Assertion.prototype.toMatch as (this: unknown, value: unknown) => void;

        // When - a file, a string and a RegExp reach toMatch
        toMatch.call(chai.Assertion.prototype, file('./expected/out.txt'));
        toMatch.call(chai.Assertion.prototype, 'out');
        toMatch.call(chai.Assertion.prototype, /out/u);

        // Then - one golden, and two answers that are vitest's own
        expect(answered).toStrictEqual(['golden', 'vitest', 'vitest']);
    });
});
