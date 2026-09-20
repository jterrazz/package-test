import { button, content, field, link } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('subscribes through the form and captures the final state', async () => {
    // Given - a visitor on the homepage
    const result = await website.visit('/', async (visitor) => {
        // When - they fill the form and subscribe
        await visitor.fill(field('Email'), 'visitor@site.test');
        await visitor.click(button('Subscribe'));
        await visitor.see(content('Thanks for subscribing'));
    });

    // Then - the capture reflects the page after the interaction
    expect(result.content).toContain('Thanks for subscribing');
    await expect(result.errors).toBeEmpty();
});

test('navigates to another page and captures where it landed', async () => {
    // Given - a visitor on the homepage
    const result = await website.visit('/', async (visitor) => {
        // When - they follow the articles link
        await visitor.click(link('Articles'));
    });

    // Then - the result is the destination page
    expect(result.url).toContain('/articles');
    expect(result.content).toContain('All articles');
});
