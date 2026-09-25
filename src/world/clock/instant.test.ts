import { describe, expect, test } from 'vitest';

import { instantOf } from './instant.js';

describe('instantOf — the one check a stated instant passes', () => {
    test('reads an ISO-8601 string as the instant it names', () => {
        // Given - an instant with an offset
        const at = instantOf('at', '2026-03-04T10:30:00+01:00');

        // Then - the same instant, in UTC
        expect(at.toISOString()).toBe('2026-03-04T09:30:00.000Z');
    });

    test('refuses what names no instant, in words that name the method that asked', () => {
        // Given - a word where an instant was expected, handed to run()
        // Then - the refusal names run(), the value, and the shape it wanted
        expect(() => instantOf('run', 'soon')).toThrow(
            new TypeError(
                `clock.run(): "soon" is not an instant — pass an ISO-8601 string (e.g. '2026-03-04T09:30:00Z').`,
            ),
        );
    });
});
