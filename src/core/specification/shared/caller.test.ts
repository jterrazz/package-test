import { describe, expect, test } from 'vitest';

import { getCallerDir } from './caller.js';

describe('caller detection', () => {
    test('returns the directory of the calling test file', () => {
        // Given - a direct call from this sibling test file (under src/core/)
        const dir = getCallerDir();

        // Then - sibling .test.ts frames are callers, not framework internals (CONVENTIONS I2)
        expect(dir).toBe(import.meta.dirname);
    });
});
