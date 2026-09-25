import { describe, expect, test } from 'vitest';

import { required } from './required.js';

describe('required — the value, or a sentence', () => {
    test('hands the value back, narrowed', () => {
        // Given - a value that is there
        const id: number | undefined = 7;

        // Then - it comes back, and the optionality is gone
        expect(required(id, 'the reply carries the new id')).toBe(7);
    });

    test('names what was missing and why it mattered', () => {
        // Given - a value that is not there
        // Then - the failure reads as a sentence, not as a TypeError
        expect(() => {
            required(undefined, 'the reply carries the new id');
        }).toThrow('the reply carries the new id — got undefined');
    });

    test('tells null from undefined', () => {
        // Given - an explicit null
        // Then - the failure says which of the two it met
        expect(() => {
            required(null, 'the header is set');
        }).toThrow('got null');
    });

    test('lets a falsy value through', () => {
        // Given - values that are present and falsy
        // Then - only null and undefined are missing
        expect([
            required(0, 'a count'),
            required('', 'a name'),
            required(false, 'a flag'),
        ]).toStrictEqual([0, '', false]);
    });
});
