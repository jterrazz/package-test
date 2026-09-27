import { describe, expect, test } from 'vitest';

import { FORK } from './fork.js';

describe('fork', () => {
    test('asks ten questions, one per kind, the module alone second to last', () => {
        // Given - the rows of the fork, in the order they are asked
        const kinds = FORK.map((row) => row.kind);

        // Then - no kind is asked twice, and the module is what is left when every assembled kind failed
        expect(new Set(kinds).size).toBe(10);
        expect(kinds.at(-2)).toBe('module');
    });
});
