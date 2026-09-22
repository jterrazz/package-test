import { expect, test } from 'vitest';

test('asserts on the raw stream', () => {
    // Given - a result
    const result = run();

    // Then - asserting on .raw bypasses what the comparison applies (D8 warn)
    expect(result.stdout.raw).toContain('ready');
});
