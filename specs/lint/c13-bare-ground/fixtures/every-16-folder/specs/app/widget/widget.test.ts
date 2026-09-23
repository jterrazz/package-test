import { expect, test } from 'vitest';

test('stands beside every 16 ground folder', () => {
    // Given - a widget
    const widget = 'widget';

    // Then - it is named
    expect(widget).toBe('widget');
});
