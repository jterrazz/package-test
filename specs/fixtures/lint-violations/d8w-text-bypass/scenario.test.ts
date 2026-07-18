import { expect, test } from 'vitest';

test('asserts on the raw text', () => {
    // Given - a result
    const result = run();

    // Then - asserting on .text bypasses the typed subject (D8 warn)
    expect(result.text).toContain('ready');
});
