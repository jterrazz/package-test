import { button, expect, heading, test } from '@jterrazz/test';

import { website } from '../website.specification.js';

test('pages through the table', async () => {
    // Given - a visitor who names what the click produced
    const result = await website.visit('/posts', async (visitor) => {
        await visitor.click(button('Next'));
        await visitor.see(heading('Page 2'));
    });

    // Then - the settled page is the one captured
    expect(result.content).toContain('Page 2');
});
