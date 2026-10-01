import { describe, expect, test } from 'vitest';

import { instantOf } from './instant.js';

describe('instantOf', () => {
    test('instantOf — the one check a stated instant passes — reads an ISO-8601 string as the instant it names', () => {
        // Given - an instant with an offset
        const at = instantOf('at', '2026-03-04T10:30:00+01:00');

        // Then - the same instant, in UTC
        expect(at.toISOString()).toBe('2026-03-04T09:30:00.000Z');
    });

    test('instantOf — the one check a stated instant passes — refuses what names no instant, in words that name the method that asked', () => {
        // Given - a word where an instant was expected, handed to run()
        // Then - the refusal names run(), the value, and the shape it wanted
        expect(() => instantOf('run', 'soon')).toThrow(
            new TypeError(
                [
                    'found: clock.run("soon"), and "soon" is not an instant',
                    'why: A clock is pinned at an instant, written as an ISO-8601 string.',
                    `fix: pass an ISO-8601 string: clock.run('2026-03-04T09:30:00Z')`,
                    'read: docs/05-module-tests.md#time',
                ].join('\n'),
            ),
        );
    });
});
