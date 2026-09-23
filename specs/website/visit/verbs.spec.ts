import { button, content, field, heading } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('verbs', () => {
    test('checks a box, and the page answers the change', async () => {
        // Given - a visitor accepting the terms
        const result = await website.visit('/landmarks', async (visitor) => {
            await visitor.check(field('Accept terms'));
            await visitor.see(content('Terms accepted'));
        });

        // Then - the answer is on the screen the capture read
        expect(result.content.text).toContain('Terms accepted');
    });

    test('presses a key in the focused field', async () => {
        // Given - a visitor typing a name and pressing Enter
        const result = await website.visit('/landmarks', async (visitor) => {
            await visitor.fill(field('Name'), 'Ada');
            await visitor.press('Enter');
            await visitor.see(content('Hello, Ada'));
        });

        // Then - the key reached the field that held the focus
        expect(result.content.text).toContain('Hello, Ada');
    });

    test('hovers an element, and the page shows what it shows on hover', async () => {
        // Given - a visitor resting the pointer on the help button
        const result = await website.visit('/landmarks', async (visitor) => {
            await visitor.hover(button('Help'));
            await visitor.see(content('Help is on its way'));
        });

        // Then - the tooltip is part of the capture
        expect(result.content.text).toContain('Help is on its way');
    });

    test('goes to another path of the site in the middle of a visit', async () => {
        // Given - a visitor who lands on the landmarks page, then goes to the articles
        const result = await website.visit('/landmarks', async (visitor) => {
            await visitor.goto('/articles');
            await visitor.see(heading('All articles'));
        });

        // Then - the result is the page the visit ended on
        expect(result.url).toContain('/articles');
    });
});
