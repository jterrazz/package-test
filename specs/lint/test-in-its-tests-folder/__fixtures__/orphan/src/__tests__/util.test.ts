import { describe, expect, test } from 'vitest';

describe('util', () => {
test('slugifies', () => {
    // Given - a helper under test naming no module of the folder above it
    // Then - flagged by `test-in-its-tests-folder`
    expect('a-b').toBe('a-b');
});
});
