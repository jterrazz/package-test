import { expect, heading, test } from '@jterrazz/test';

import { website } from '../website.specification.js';

test('shows the posts', async () => {
    // Given - the home page
    const result = await website.visit('/', async (visitor) => {
        await visitor.see(heading('Posts'));
    });
    // Then - the page names the collection
    expect(result.content).toContain('Posts');
});
