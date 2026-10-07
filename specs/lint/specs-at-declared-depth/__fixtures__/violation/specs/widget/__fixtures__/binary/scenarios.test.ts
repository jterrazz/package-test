import { describe, expect, test } from 'vitest';

describe('scenarios', () => {
test('a test with no module beside it is a spec that wandered into the ground', () => {
    // Given - nothing named scenarios.ts sits next to this file
    // Then - `specs-at-declared-depth` reports it, whatever the declared depth
    expect(1).toBe(1);
});
});
