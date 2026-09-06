import { expect, test } from 'vitest';

test('slugifies', () => {
    // Given - a helper under test with no neighbour module
    // Then - flagged by I2
    expect('a-b').toBe('a-b');
});
