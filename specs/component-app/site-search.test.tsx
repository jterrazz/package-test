import { button, component, field, search, within } from '@jterrazz/test';
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

test('names a candidate inside a `<search>` element by its landmark', async () => {
    // Given - a "Go" button inside the `<search>` and another in the `<main>`
    const refusal = await component
        .render(<SiteSearch />, async (visitor) => {
            await visitor.click(button('Go'));
        })
        .then(() => '')
        .catch((error: unknown) => (error instanceof Error ? error.message : ''));

    // Then - the element's landmark is evidence, and its scope a rewrite
    expect(refusal).toContain('in <search>');
    expect(refusal).toContain('within(search(), button("Go"))');
});
