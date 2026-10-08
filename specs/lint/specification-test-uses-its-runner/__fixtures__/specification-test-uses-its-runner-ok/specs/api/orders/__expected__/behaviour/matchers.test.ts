import { describe, expect, test } from 'vitest';

// The GOLDEN: what the fixer is expected to write. It is ground, not a spec —
// it reaches no runner because nothing here runs it.
describe('matchers', () => {
test('reads the matcher the fixer wrote', () => {
    // Given
    const written = 'toBeEmpty';

    // Then
    expect(written).toBe('toBeEmpty');
});
});
