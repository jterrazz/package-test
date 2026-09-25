import { button, component, status } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { CountedButton } from './counted-button.js';

test('the name a descriptor matches is the computed one, not the text', async () => {
    // Given - a descriptor naming part of the computed name
    const result = await component.render(<CountedButton />, async (visitor) => {
        await visitor.gone(button('Experiments'));
    });

    // Then - the partial name designates nothing, and the whole outline, compared in place, names the button as the browser computed it, spaces and all
    await expect(result.tree).toMatch(`
        - main:
          - button "Experiments 9"`);
});

test('the computed name, written whole, designates the button', async () => {
    // Given - the spelling the outline prints, written into the spec exactly
    const result = await component.render(<CountedButton />, async (visitor) => {
        await visitor.click(button('Experiments 9'));
        await visitor.see(status());
    });

    // Then - it resolved: the outline's name is a name that can be written
    expect(result.content.text).toContain('opened');
});
