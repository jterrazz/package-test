import { describe, expect, test } from 'vitest';

describe('misc', () => {
    test('carries the name spec-named-for-its-aspect refuses a spec, and is none of its business', () => {
        // Given - a module test under the same catch-all name
        const where = 'misc';

        // Then - it is named
        expect(where).toBe('misc');
    });
});
