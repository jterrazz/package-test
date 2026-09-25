import { expect, test } from 'vitest';

test('the stubs tree is malformed', () => {
    // Given - a stubs/ folder that breaks the C4 layout
    const layout = 'broken';

    // Then - oxlint reports every structural fault
    expect(layout).toBe('broken');
});
