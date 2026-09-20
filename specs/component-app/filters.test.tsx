import {
    button,
    component,
    content,
    field,
    option,
    selected,
    status,
    valued,
    within,
} from '@jterrazz/test';
import type { ElementRef } from '@jterrazz/test';
import { expect, test, vi } from 'vitest';

import { Filters } from './filters.js';

/** What the form reports when it is applied — the one callback these specs watch. */
type Apply = (summary: string) => void;

/**
 * The option the Sort field is on, scoped to that field. Named rather than
 * written inline: three descriptors inside a verb is one call too deep for
 * `unicorn/max-nested-calls`, and a named Given reads better anyway.
 */
const sortedBy = (name: string): ElementRef => within(field('Sort'), selected(option(name)));

test('carries every filter the visitor set into the summary it reports', async () => {
    // Given - a visitor who types, checks, selects and applies
    const onApply = vi.fn<Apply>();
    const result = await component.render(<Filters onApply={onApply} />, async (visitor) => {
        await visitor.fill(field('Search'), 'hexagonal');
        await visitor.check(field('Include drafts'));
        await visitor.select(field('Sort'), 'oldest');
        await visitor.click(button('Apply'));
        await visitor.see(status());
    });

    // Then - the component reported exactly what was on the form
    expect(onApply).toHaveBeenCalledExactlyOnceWith('hexagonal · with drafts · oldest');
    expect(result.content).toContain('Showing hexagonal · with drafts · oldest');
});

test('takes the summary off the screen when the visitor clears it', async () => {
    // Given - a summary on screen, then cleared. The descriptor names the line WHOLE: a name designates the accessible name entire, and `content('Showing everything')` designates nothing here
    const summary = content('Showing everything · published · newest');
    const result = await component.render(<Filters onApply={vi.fn<Apply>()} />, async (visitor) => {
        await visitor.click(button('Apply'));
        await visitor.see(summary);
        await visitor.click(button('Clear'));
        await visitor.gone(summary);
    });

    // Then - the screen the capture describes is the one the clearing left
    expect(result.content).not.toContain('Showing everything');
});

test('names the options a field offers, and the one it is on', async () => {
    // Given - the sort field, read before and after the visitor changes it
    const result = await component.render(<Filters onApply={vi.fn<Apply>()} />, async (visitor) => {
        await visitor.see(within(field('Sort'), option('Oldest')));
        await visitor.see(sortedBy('Newest'));
        await visitor.select(field('Sort'), 'oldest');
        await visitor.see(sortedBy('Oldest'));
        await visitor.gone(sortedBy('Newest'));
    });

    // Then - the tree carries the selection the verbs answered about; not one of those options ever had a box on the screen to be seen through
    expect(result.tree).toContain('option "Oldest" [selected]');
    await expect(result.errors).toBeEmpty();
});

test('says what a text field holds, in both directions', async () => {
    // Given - a search field filled, then emptied again
    const result = await component.render(<Filters onApply={vi.fn<Apply>()} />, async (visitor) => {
        await visitor.fill(field('Search'), 'hexagonal');
        await visitor.see(valued(field('Search'), 'hexagonal'));
        await visitor.fill(field('Search'), '');
        await visitor.gone(valued(field('Search'), 'hexagonal'));
        await visitor.see(valued(field('Search'), ''));
    });

    // Then - the field ended empty, and the outline says so too
    expect(result.tree).toContain('textbox "Search"');
    expect(result.tree).not.toContain('hexagonal');
});

test('submits from the keyboard the way a form does', async () => {
    // Given - a visitor who hovers the button, then presses Enter in the field
    const onApply = vi.fn<Apply>();
    await component.render(<Filters onApply={onApply} />, async (visitor) => {
        await visitor.hover(button('Apply'));
        await visitor.fill(field('Search'), 'keyboard');
        await visitor.press('Enter');
        await visitor.see(status());
    });

    // Then - the form applied once, with what was typed
    expect(onApply).toHaveBeenCalledExactlyOnceWith('keyboard · published · newest');
});
