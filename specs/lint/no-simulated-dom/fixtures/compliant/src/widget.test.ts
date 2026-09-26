import { describe, expect, test } from 'vitest';

describe('widget', () => {
test('names the widget', () => {
    // Given - a plain module under node
    const label = 'Widget';

    // Then - no environment pragma is needed
    expect(label).toBe('Widget');
});
});
