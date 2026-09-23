import { expect, test } from 'vitest';

test('has Then before Given', () => {
    // Then - it works
    // Given - a thing
    expect(run()).toBe(true);
});

test('also orders Then before Given', () => {
    // Then - it still works
    // Given - another thing
    expect(run()).toBe(true);
});
