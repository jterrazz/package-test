import { expect, test } from 'vitest';

test('asserts on the comparable text', () => {
    // Given - a result
    const result = run();

    // Then - the text a golden compares
    expect(result.stdout.text).toContain('ready');
});
