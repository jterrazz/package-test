import { expect, test } from 'vitest';

test('builds a node', () => {
    // Given - a module test reaching for a document
    const node = document.createElement('div');

    // Then - it is not a module test at all
    expect(node).toBeDefined();
});
