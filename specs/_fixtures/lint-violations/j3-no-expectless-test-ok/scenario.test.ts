import { expect, test } from 'vitest';

test('asserts an outcome', () => {
    // Given - a thing
    // Then - the outcome is asserted
    expect(doThing()).toBe(true);
});
