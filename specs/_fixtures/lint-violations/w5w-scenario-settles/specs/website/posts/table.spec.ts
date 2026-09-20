import { button, expect, test } from '@jterrazz/test';

import { website } from '../website.specification.js';

test('pages through the table', async () => {
    // Given - a visitor who clicks and stops there
    const result = await website.visit('/posts', async (visitor) => {
        await visitor.click(button('Next'));
    });

    // Then - the page is whatever the capture caught
    expect(result.content).toContain('Posts');
});
