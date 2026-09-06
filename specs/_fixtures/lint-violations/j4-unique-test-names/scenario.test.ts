import { expect, test } from 'vitest';

test('does a thing', () => {
    // Given - a thing
    // Then - it works
    expect(run()).toBe(true);
});

test('does a thing', () => {
    // Given - the same name again
    // Then - it also works (duplicate name, J4)
    expect(run()).toBe(true);
});
