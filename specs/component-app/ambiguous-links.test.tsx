import { component, link } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { AmbiguousLinks } from './ambiguous-links.js';

test('refuses a descriptor matching several elements, and says how to fix it', async () => {
    // Given - two links with the same accessible name, in different regions
    const refusal = await component
        .render(<AmbiguousLinks />, async (visitor) => {
            await visitor.click(link('Articles'));
        })
        .catch((error: unknown) => (error instanceof Error ? error.message : ''));

    // Then - the refusal is the website facet's, word for word: same rule, same fix
    expect(refusal).toContain('Ambiguous element: link("Articles") matched 2 elements');
    expect(refusal).toContain('within(navigation(), link("Articles"))');
    expect(refusal).toContain('CONVENTIONS W3');
});

test('designates one of two overlapping names when the match is made exact', async () => {
    // Given - the same two links, met by a descriptor matching the name WHOLE
    const result = await component.render(<AmbiguousLinks />, async (visitor) => {
        await visitor.see(link('Articles', { exact: true }));
    });

    // Then - one element answered where the substring match found two, and the
    // Longer name is still on the screen: the descriptor narrowed, not the DOM
    expect(result.content).toContain('Articles archive');
});
