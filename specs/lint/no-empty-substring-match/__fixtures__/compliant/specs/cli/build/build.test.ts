import { describe, expect, test } from 'vitest';

describe('build', () => {
test('prints nothing', () => {
    // Given - a CLI result
    const result = call();

    // Then - the text is compared whole, and the accessor is the one handed to toMatch
    expect(result.stdout.text).toBe('');
    expect(result.stderr).toMatch('');
});
});
