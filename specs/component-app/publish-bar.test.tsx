import { button, component, disabled, enabled, field } from '@jterrazz/test';
import { test } from 'vitest';

import { PublishBar } from './publish-bar.js';

test('refuses to publish until the checklist is acknowledged', async () => {
    // Given - the bar as it opens, then with the box ticked
    await component.render(<PublishBar />, async (visitor) => {
        await visitor.see(disabled(button('Publish')));
        await visitor.check(field('I have read the checklist'));
        await visitor.see(enabled(button('Publish')));
        await visitor.gone(disabled(button('Publish')));
    });
});
