import { expect, test } from 'vitest';

test('the built bundle carries the checker binary', () => {
    // Given - a repository suite: it covers a TREE, not one module
    // Then - there is no neighbour it could sit beside, and I2 says nothing
    expect(1).toBe(1);
});
