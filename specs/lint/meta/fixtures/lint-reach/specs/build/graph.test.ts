import { expect, test } from 'vitest';

test('walks the tree, while tripping the rules a repository suite reaches', () => {
    // Given - a consistency suite that sleeps, writes the environment, and touches the DOM
    setTimeout(() => 'graph', 10);
    process.env.GRAPH = 'on';
    const node = document.querySelector('#graph');
    // Then - a repository suite is a kind, not a misplaced module test
    expect(node).toBe(null);
});
