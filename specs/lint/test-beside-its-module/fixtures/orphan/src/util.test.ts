import { describe, expect, test } from 'vitest';

describe('util', () => {
test('slugifies', () => {
    // Given - a helper under test with no neighbour module
    // Then - flagged by `test-beside-its-module`
    expect('a-b').toBe('a-b');
});
});
