import { describe, expect, test } from 'vitest';

describe('exports', () => {
test('publishes its entry', () => {
    // Given - one test in a first-level folder that is no specification
    // Then - the one test is enough to make the folder a repository suite
    expect(1).toBe(1);
});
});
