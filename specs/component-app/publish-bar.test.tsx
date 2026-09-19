import { button, component, disabled, enabled, field } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { PublishBar } from './publish-bar.js';

test('refuses to publish until the checklist is acknowledged', async () => {
    // Given - the bar as it opens, then with the box ticked
    const result = await component.render(<PublishBar />, async (visitor) => {
        await visitor.see(disabled(button('Publish')));
        await visitor.check(field('I have read the checklist'));
        await visitor.see(enabled(button('Publish')));
        await visitor.gone(disabled(button('Publish')));
    });

    // Then - the markup agrees with what the verbs answered
    expect(result.html).not.toContain('disabled');
});
