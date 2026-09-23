import {
    banner,
    complementary,
    component,
    content,
    contentinfo,
    field,
    form,
    heading,
    link,
    search,
    within,
} from '@jterrazz/test';
import { expect, test } from 'vitest';

import { PageFrame } from './page-frame.js';

test('names each landmark of a layout, and scopes an element to one', async () => {
    // Given - a frame with a header, a sidebar, a named form, a search region and a footer
    const result = await component.render(<PageFrame />, async (visitor) => {
        await visitor.see(within(banner(), heading('Frame')));
        await visitor.see(within(complementary('Related'), link('Related post')));
        await visitor.see(within(form('Newsletter'), field('Email')));
        await visitor.see(within(search(), field('Query')));
        await visitor.see(within(contentinfo(), content('Frame footer')));
    });

    // Then - each scope answered, and the page complained of nothing
    expect(result.errors.text).toBe('');
});
