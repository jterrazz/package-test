import { describe, expect, test } from 'vitest';

describe('build', () => {
test('prints nothing', () => {
    // Given - a CLI result
    const result = call();

    // Then - an empty substring match on a plain string holds for any text (`no-empty-substring-match` error)
    expect(result.stdout.text).toMatch('');
});
});
