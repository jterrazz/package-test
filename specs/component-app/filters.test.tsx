import { button, component, content, field, status } from '@jterrazz/test';
import { expect, test, vi } from 'vitest';

import { Filters } from './filters.js';

/** What the form reports when it is applied — the one callback these specs watch. */
type Apply = (summary: string) => void;

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
    // Given - a summary on screen, then cleared
    const result = await component.render(<Filters onApply={vi.fn<Apply>()} />, async (visitor) => {
        await visitor.click(button('Apply'));
        await visitor.see(content('Showing everything'));
        await visitor.click(button('Clear'));
        await visitor.gone(content('Showing everything'));
    });

    // Then - the screen the capture describes is the one the clearing left
    expect(result.content).not.toContain('Showing everything');
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
