import { button, component, status } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { CountedButton } from './counted-button.js';

test('the name the window prints is the computed one, not the text', async () => {
    // Given - a descriptor naming part of the computed name, which the transitional window widens
    const result = await component.render(<CountedButton />, async (visitor) => {
        await visitor.click(button('Experiments'));
        await visitor.see(status());
    });

    // Then - the outline names the button as the browser computed it, spaces and all
    expect(result.tree).toContain('button "Experiments 9"');
    expect(result.content).toContain('opened');
});

test('that name, written back, designates the same button as a WHOLE name', async () => {
    // Given - the spelling the window prints, written into the spec exactly
    const result = await component.render(<CountedButton />, async (visitor) => {
        await visitor.click(button('Experiments 9'));
        await visitor.see(status());
    });

    // Then - it resolved with no widening: a printed name that cannot be written is no answer
    expect(result.content).toContain('opened');
});
