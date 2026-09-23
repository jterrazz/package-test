import { heading } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../deployed.specification.js';

test('visits a site already running, at the address it was given', async () => {
    // Given - a runner that started nothing, pointed at a running site
    const result = await website.visit('/articles', async (visitor) => {
        await visitor.see(heading('All articles'));
    });

    // Then - the page is the running site's
    expect(result.title.text).toBe('Fixture — Articles');
});
