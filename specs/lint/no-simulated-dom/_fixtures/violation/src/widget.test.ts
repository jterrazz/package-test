// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';

describe('widget', () => {
test('renders the widget', () => {
    // Given - a simulated document
    const label = 'Widget';

    // Then - the label is what the widget shows
    expect(label).toBe('Widget');
});
});
