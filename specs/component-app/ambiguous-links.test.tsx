import { component, link } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { AmbiguousLinks } from './ambiguous-links.js';

/** The message text a failed render hands back, or '' when it did not fail. */
async function refusalOf(scenario: Parameters<typeof component.render>[1]): Promise<string> {
    return await component
        .render(<AmbiguousLinks />, scenario)
        .then(() => '')
        .catch((error: unknown) => (error instanceof Error ? error.message : ''));
}

test('refuses a descriptor matching several elements, and says how to fix it', async () => {
    // Given - two links carrying the SAME whole accessible name, in two regions
    const refusal = await refusalOf(async (visitor) => {
        await visitor.click(link('Articles'));
    });

    // Then - the refusal is the website facet's, word for word: same rule, same fix
    expect(refusal).toContain('Ambiguous element: link("Articles") matched 2 elements');
    expect(refusal).toContain('within(navigation(), link("Articles"))');
    expect(refusal).toContain('CONVENTIONS W3');
});

test('a name designates the accessible name WHOLE — the default', async () => {
    // Given - the same three links, one of which only CONTAINS the name
    const result = await component.render(<AmbiguousLinks />, async (visitor) => {
        await visitor.see(link('Articles archive'));
    });

    // Then - "Articles archive" is one element, not two, and the longer name is still on the screen: the descriptor narrowed, not the DOM
    expect(result.content).toContain('Articles archive');
});

test('`{ exact: false }` brings the substring match back, and the ambiguity with it', async () => {
    // Given - the pre-16.0 matching, asked for explicitly
    const refusal = await refusalOf(async (visitor) => {
        await visitor.click(link('Articles', { exact: false }));
    });

    // Then - the third link answers again, which is what the old default hid
    expect(refusal).toContain('matched 3 elements');
});

test('a name that only matches as a substring still resolves', async () => {
    // Given - a name no element carries whole, and exactly one element carries in part

    // `see()` rather than `click()`: the window resolves it, and a resolved
    // Click would navigate the mounted page out from under the runner.
    const refusal = await refusalOf(async (visitor) => {
        await visitor.see(link('archive'));
    });

    // Then - the transitional window resolved it rather than waiting out the budget
    expect(refusal).toBe('');
});
