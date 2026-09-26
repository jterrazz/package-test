import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

describe('negative', () => {
test('asserts the mismatch diff on an unfrozen fixture', () => {
    // Given - output that differs from a deliberately-wrong fixture
    const result = call();

    // Then - the mismatch is asserted, but the fixture is unfrozen (`negative-golden-frozen` warn)
    expect(() => expect(result.stdout).toMatch(file('./_expected/wrong.txt'))).toThrow(/mismatch/); // checker-disable-line ground-shared-or-inline -- an input tree of the negative-golden-frozen spec: its file form is what the rule reads
});
});
