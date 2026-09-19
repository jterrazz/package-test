import { component, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { ViewportNote } from './viewport-note.js';

test('renders for the page size the test gave it', async () => {
    // Given - a page narrower than the note's own breakpoint
    const result = await component
        .viewport({ height: 640, width: 400 })
        .render(<ViewportNote />, async (visitor) => {
            await visitor.see(content('Narrow layout'));
        });

    // Then - the narrow branch is what the page shows
    expect(result.content).toContain('Narrow layout');
});

test('is restored to the project size for the next test', async () => {
    // Given - no viewport of its own, so the project's 1280x720 stands
    await component.render(<ViewportNote />, async (visitor) => {
        await visitor.see(content('Wide layout'));
    });
});

test('captures the text the page renders, not everything the document holds', async () => {
    // Given - a component carrying a stylesheet and a node it does not display
    const result = await component.render(<ViewportNote />, async (visitor) => {
        await visitor.see(content('Wide layout'));
    });

    // Then - `content` is what a reader sees; the markup keeps the rest
    expect(result.content).not.toContain('rebeccapurple');
    expect(result.content).not.toContain('Drafted, never shown');
    expect(result.html).toContain('Drafted, never shown');
});
