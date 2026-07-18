import { expect, test } from 'vitest';

test('asserts the mismatch diff on a frozen fixture', () => {
    // Given - output that differs from a deliberately-wrong fixture
    const result = call();

    // Then - the frozen opt-out keeps the fixture safe under TEST_UPDATE (no D13 warn)
    expect(() => expect(result.stdout).toMatch('wrong.txt', { frozen: true })).toThrow(/mismatch/);
});
