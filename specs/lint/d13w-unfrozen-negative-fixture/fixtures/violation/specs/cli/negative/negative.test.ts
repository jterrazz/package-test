import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

test('asserts the mismatch diff on an unfrozen fixture', () => {
    // Given - output that differs from a deliberately-wrong fixture
    const result = call();

    // Then - the mismatch is asserted, but the fixture is unfrozen (D13 warn)
    expect(() => expect(result.stdout).toMatch(file('./expected/wrong.txt'))).toThrow(/mismatch/); // checker-disable-line c28 -- an input tree of the d13w-unfrozen-negative-fixture spec: its file form is what the rule reads
});
