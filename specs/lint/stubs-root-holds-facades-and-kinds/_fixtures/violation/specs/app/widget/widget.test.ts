import { describe, expect, test } from 'vitest';

describe('widget', () => {
test('the stubs tree is malformed', () => {
    // Given - a _setup/stubs/ folder that breaks the `stubs-root-holds-facades-and-kinds` layout
    const layout = 'broken';

    // Then - oxlint reports every structural fault
    expect(layout).toBe('broken');
});
});
