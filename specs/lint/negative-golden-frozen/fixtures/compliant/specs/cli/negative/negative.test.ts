import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

describe('negative', () => {
test('asserts the mismatch diff on a frozen fixture', () => {
    // Given - output that differs from a deliberately-wrong fixture
    const result = call();

    // Then - the frozen opt-out keeps the fixture safe under TEST_UPDATE (no `negative-golden-frozen` warn)
    expect(() => expect(result.stdout).toMatch(file('./expected/wrong.txt'), { frozen: true })).toThrow(/mismatch/); // checker-disable-line ground-shared-or-inline -- an input tree of the negative-golden-frozen spec: its file form is what the rule reads
});
});
