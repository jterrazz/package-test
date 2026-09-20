import { field, option, selected, valued, within } from '@jterrazz/test';
import type { ElementRef } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

/**
 * The channel the select is on, scoped to that field. Named rather than
 * written inline: three descriptors inside a verb is one call too deep for
 * `unicorn/max-nested-calls`.
 */
const channelIs = (name: string): ElementRef => within(field('Channel'), selected(option(name)));

test('names an option of a field, and which one the field is on', async () => {
    // Given - a channel select, read before and after the visitor changes it
    const result = await website.visit('/', async (visitor) => {
        await visitor.see(within(field('Channel'), option('LinkedIn')));
        await visitor.see(channelIs('X'));
        await visitor.select(field('Channel'), 'linkedin');
        await visitor.see(channelIs('LinkedIn'));
        await visitor.gone(channelIs('X'));
    });

    // Then - an option is answered by presence, never by a box on the screen, and the selection is in the tree the page hands back
    expect(result.tree).toContain('option "LinkedIn" [selected]');
});

test('says what a field holds, which no accessibility tree carries', async () => {
    // Given - an email field filled by the visitor
    const result = await website.visit('/', async (visitor) => {
        await visitor.gone(valued(field('Email'), 'visitor@site.test'));
        await visitor.fill(field('Email'), 'visitor@site.test');
        await visitor.see(valued(field('Email'), 'visitor@site.test'));
    });

    // Then - a tree carries a field's value too, so the modifier is not the only way to read one: it is how the ONE field a test is about is waited for
    expect(result.tree).toContain('visitor@site.test');
    await expect(result.errors).toBeEmpty();
});
