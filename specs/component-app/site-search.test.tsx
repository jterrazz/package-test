import { component, field, search, within } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { SiteSearch } from './site-search.js';

test('finds a `<search>` element as the search landmark, named and not', async () => {
    // Given - a search landmark the element carries, with no role attribute
    const result = await component.render(<SiteSearch />, async (visitor) => {
        await visitor.see(within(search(), field('Query')));
        await visitor.see(within(search('Site'), field('Query')));
    });

    // Then - both scopes answered, and the page complained of nothing
    expect(result.errors.text).toBe('');
});
