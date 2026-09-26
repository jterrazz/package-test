import { describe, expect, test } from 'vitest';

import { tightened } from './fix.js';

describe('tightened', () => {
    test('the test ratchet under --fix — what fell is recorded, what rose is not — a fix records what fell and never what rose, and leaves the run its key', () => {
        // Given - one count fell, one reached zero, one rose, one is new, and the run's key
        const next = tightened(
            { 'jterrazz-check/c9': 1, 'jterrazz/d16w': 5, 'jterrazz/new': 2 },
            {
                'jterrazz-check/c15': 2,
                'jterrazz-check/c9': 3,
                'jterrazz/d16w': 4,
                'routes/unreached': 1,
            },
        );

        // Then - the fall lowered, the paid entry gone, the rise and the new key left for the verdict
        expect(next).toStrictEqual({
            'jterrazz-check/c9': 1,
            'jterrazz/d16w': 4,
            'routes/unreached': 1,
        });
    });

    test('the test ratchet under --fix — what fell is recorded, what rose is not — a fix records nothing when nothing fell', () => {
        // Given - every count at or above its entry
        // Then - no section to write
        expect(
            tightened(
                { 'jterrazz-check/c9': 3 },
                { 'jterrazz-check/c9': 2, 'routes/unreached': 1 },
            ),
        ).toBeUndefined();
    });
});
