import { expect, test } from 'vitest';

test('asserts the mismatch diff on an unfrozen fixture', () => {
    // Given - output that differs from a deliberately-wrong fixture
    const result = call();

    // Then - the mismatch is asserted, but the fixture is unfrozen (D13 warn)
    expect(() => expect(result.stdout).toMatch('wrong.txt')).toThrow(/mismatch/);
});
