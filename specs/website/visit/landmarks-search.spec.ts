import { field, search, within } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('landmarks-search', () => {
    test('finds a `<search>` element as the search landmark, named and not', async () => {
        // Given - a search landmark the element carries, with no role attribute
        const result = await website.visit('/search', async (visitor) => {
            await visitor.see(within(search(), field('Query')));
            await visitor.see(within(search('Site'), field('Query')));
        });

        // Then - the tree calls it what the scopes found
        expect(result.tree.text).toContain('search "Site"');
    });
});
