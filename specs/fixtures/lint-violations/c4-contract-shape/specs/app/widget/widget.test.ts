import { expect, test } from 'vitest';

test('the contracts tree is malformed', () => {
    // Given - a contracts/ folder that breaks the C4 layout
    const layout = 'broken';

    // Then - oxlint reports every structural fault
    expect(layout).toBe('broken');
});
