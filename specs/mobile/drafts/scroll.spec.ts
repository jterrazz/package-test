import { button, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('scroll', () => {
    test('a button below the fold is scrolled into view, then tapped', async () => {
        // Given - a visitor on the drafts screen, whose last button is mounted off screen
        const result = await mobile.open('specimen://drafts', async (visitor) => {
            // When - they tap it without scrolling first
            await visitor.tap(button('Load older drafts'));
            await visitor.see(content('No older drafts'));
        });

        // Then - the tap landed on the button the screen had to scroll to
        expect(result.content.text).toBe('No older drafts');
    });
});
