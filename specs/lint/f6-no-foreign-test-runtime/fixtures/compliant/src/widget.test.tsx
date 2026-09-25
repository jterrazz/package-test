import { component, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('Widget', () => {
test('renders the widget', async () => {
    // Given - the framework's own chain
    const result = await component.render(<p>Widget</p>, async (visitor) => {
        await visitor.see(content('Widget'));
    });

    // Then - the rendered text is the widget's
    expect(result.content).toContain('Widget');
});
});
