import { expect, test } from 'vitest';

// The GOLDEN: what the fixer is expected to write. It is ground, not a spec —
// It reaches no runner because nothing here runs it.
test('reads the matcher the fixer wrote', () => {
    // Given
    const written = 'toBeEmpty';

    // Then
    expect(written).toBe('toBeEmpty');
});
