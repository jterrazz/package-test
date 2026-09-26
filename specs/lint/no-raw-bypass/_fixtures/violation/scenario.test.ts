import { describe, expect, test } from 'vitest';

describe('scenario', () => {
test('asserts on the raw stream', () => {
    // Given - a result
    const result = run();

    // Then - asserting on .raw bypasses what the comparison applies (`no-raw-bypass` warn)
    expect(result.stdout.raw).toContain('ready');
});
});
