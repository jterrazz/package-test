import { button, content, disabled, enabled, field, focused } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('sees a confirmation that was not on the page before the click', async () => {
    // Given - a homepage whose confirmation is hidden until the form is used
    const result = await website.visit('/', async (visitor) => {
        await visitor.gone(content('Thanks for subscribing'));
        await visitor.click(button('Subscribe'));
        await visitor.see(content('Thanks for subscribing'));
    });

    // Then - the capture describes the page the click left behind
    expect(result.content).toContain('Thanks for subscribing');
});

test('says where the keyboard is after a field was filled', async () => {
    // Given - a visitor typing into the email field
    const result = await website.visit('/', async (visitor) => {
        await visitor.fill(field('Email'), 'visitor@site.test');
        await visitor.see(focused(field('Email')));
        await visitor.gone(focused(button('Subscribe')));
    });

    // Then - both verbs answered on the settled page, and it stayed silent
    await expect(result.errors).toBeEmpty();
});

test('says whether a control is taking input, in both directions', async () => {
    // Given - a clear button the page enables only once there is something to clear
    const result = await website.visit('/', async (visitor) => {
        await visitor.see(disabled(button('Clear')));
        await visitor.click(button('Subscribe'));
        await visitor.see(enabled(button('Clear')));
        await visitor.gone(disabled(button('Clear')));
    });

    // Then - the page stayed silent through all four answers
    await expect(result.errors).toBeEmpty();
});
