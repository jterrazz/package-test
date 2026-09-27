import { describe, expect, test } from 'vitest';

import { invariant } from './invariant.js';

describe('invariant', () => {
    test('invariant — a broken invariant — is an error that says the bug is the framework’s, then what broke', () => {
        // Given - an invariant the framework holds for itself
        const error = invariant('the run containers are served on no port');

        // Then - the message clears the test, and names the invariant
        expect(error.message).toBe(
            '@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: the run containers are served on no port',
        );
    });
});
