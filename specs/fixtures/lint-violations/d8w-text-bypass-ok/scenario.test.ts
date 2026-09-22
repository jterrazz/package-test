import { expect, test } from 'vitest';

test('asserts on the typed subject', () => {
    // Given - a result
    const result = run();

    // Then - the accessor subject carries the grammar
    expect(result).toContain('ready');
});
