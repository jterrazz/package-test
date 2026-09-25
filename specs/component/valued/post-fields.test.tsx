import { component, field, valued } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { PostFields } from './post-fields.js';

describe('PostFields', () => {
    test('says what a text field holds, in both directions', async () => {
        // Given - a search field filled, then emptied again
        const result = await component.render(<PostFields />, async (visitor) => {
            await visitor.fill(field('Search'), 'hexagonal');
            await visitor.see(valued(field('Search'), 'hexagonal'));
            await visitor.fill(field('Search'), '');
            await visitor.gone(valued(field('Search'), 'hexagonal'));
            await visitor.see(valued(field('Search'), ''));
        });

        // Then - the field ended empty, and the outline says so too
        expect(result.tree.text).toContain('textbox "Search"');
        expect(result.tree.text).not.toContain('hexagonal');
    });

    test('reads back what a wrapped field holds', async () => {
        // Given - a field whose label wraps it, read through the value modifier
        const result = await component.render(<PostFields />, async (visitor) => {
            await visitor.fill(field('Title'), 'hexagonal');
            await visitor.see(valued(field('Title'), 'hexagonal'));
        });

        // Then - the outline carries the field it read
        expect(result.tree.text).toContain('textbox "Title"');
    });
});
