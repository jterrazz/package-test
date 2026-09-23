import { expect, test } from 'vitest';

test('a test with no module beside it is a spec that wandered into the ground', () => {
    // Given - nothing named scenarios.ts sits next to this file
    // Then - C1 reports it, whatever the declared depth
    expect(1).toBe(1);
});
