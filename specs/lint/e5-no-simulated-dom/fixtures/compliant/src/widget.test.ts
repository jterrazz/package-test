import { expect, test } from 'vitest';

test('names the widget', () => {
    // Given - a plain module under node
    const label = 'Widget';

    // Then - no environment pragma is needed
    expect(label).toBe('Widget');
});
