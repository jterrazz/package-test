import { describe, expect, test } from 'vitest';

describe('scenario', () => {
test('asserts on the comparable text', () => {
    // Given - a result
    const result = run();

    // Then - the text a golden compares
    expect(result.stdout.text).toContain('ready');
});
});
