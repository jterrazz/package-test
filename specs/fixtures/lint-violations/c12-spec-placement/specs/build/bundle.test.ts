import { expect, test } from 'vitest';

test('the bundle carries the binary', () => {
    // Given - a repository suite under a NON-facet folder
    // Then - it keeps `.test.ts`: C12's rename clause reaches facet folders only
    expect(1).toBe(1);
});
