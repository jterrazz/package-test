import { component, content, listitem } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { renderSessionRows } from './session-rows.js';

test('renders a vanilla DOM list in the same browser, under the same visitor', async () => {
    // Given - a DOM function handed a container, with no React anywhere
    const result = await component.render(
        (container) => {
            renderSessionRows(container, [
                { label: 'morning sync', tone: 'live' },
                { label: 'evening sweep', tone: 'idle' },
            ]);
        },
        async (visitor) => {
            await visitor.see(content('morning sync'));
        },
    );

    // Then - the class tones are what the markup carries, and nothing complained
    expect(result.html).toContain('row row--live');
    expect(result.html).toContain('row row--idle');
    await expect(result.errors).toBeEmpty();
});

test('names a list item by its role where the list holds exactly one', async () => {
    // Given - a one-row list, so the role designates exactly one element (W3)
    const result = await component.render(
        (container) => {
            renderSessionRows(container, [{ label: 'only one', tone: 'idle' }]);
        },
        async (visitor) => {
            await visitor.see(listitem());
        },
    );

    // Then - the role named the row the list holds
    expect(result.content).toContain('only one');
});
