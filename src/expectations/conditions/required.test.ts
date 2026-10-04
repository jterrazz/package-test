import { describe, expect, test } from 'vitest';

import { required } from './required.js';

describe('required', () => {
    test('required — the value, or a sentence — hands the value back, narrowed', () => {
        // Given - a value that is there
        const id: number | undefined = 7;

        // Then - it comes back, and the optionality is gone
        expect(required(id, 'the reply carries the new id')).toBe(7);
    });

    test('required — the value, or a sentence — names what was missing and why it mattered', () => {
        // Given - a value that is not there
        // Then - the failure reads as a sentence, not as a TypeError
        expect(() => {
            required(undefined, 'the reply carries the new id');
        }).toThrow(
            new Error(
                [
                    'found: required(): the reply carries the new id — got undefined',
                    'why: `required()` answers a present value, and `null` and `undefined` are the two it refuses.',
                    'fix: state it in the Given, or assert on what the subject actually produced',
                    'read: docs/21-assertions.md#two-helpers-that-are-not-matchers',
                ].join('\n'),
            ),
        );
    });

    test('required — the value, or a sentence — tells null from undefined', () => {
        // Given - an explicit null
        // Then - the failure says which of the two it met
        expect(() => {
            required(null, 'the header is set');
        }).toThrow('got null');
    });

    test('required — the value, or a sentence — lets a falsy value through', () => {
        // Given - values that are present and falsy
        // Then - only null and undefined are missing
        expect([
            required(0, 'a count'),
            required('', 'a name'),
            required(false, 'a flag'),
        ]).toStrictEqual([0, '', false]);
    });
});
