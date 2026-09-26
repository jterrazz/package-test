import { describe, expect, test } from 'vitest';

describe('misc', () => {
    test('asks nothing a name could say, where spec-named-for-its-aspect — a rule of the spec reach — finds it', () => {
        // Given - a spec named for what fit nowhere else
        const where = 'misc';

        // Then - it is named
        expect(where).toBe('misc');
    });
});
