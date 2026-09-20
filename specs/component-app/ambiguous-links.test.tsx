import { component, link } from '@jterrazz/test';
import { expect, test, vi } from 'vitest';

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

test('a name designates the accessible name WHOLE — the 16.0 default', async () => {
    // Given - the same three links, one of which only CONTAINS the name
    const result = await component.render(<AmbiguousLinks />, async (visitor) => {
        await visitor.see(link('Articles archive'));
    });

    // Then - "Articles archive" is one element, not two, and the longer name is
    // Still on the screen: the descriptor narrowed, not the DOM
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

test('a name that only matches as a substring says what changed, once', async () => {
    // Given - a name no element carries whole, and one element carries in part
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const refusal = await refusalOf(async (visitor) => {
        await visitor.click(link('archive'));
    });

    // Then - the descriptor designates nothing, and the transitional warning
    // Names the two releases it ships for so the reader knows the deadline
    expect(refusal).not.toBe('');
    const lines = warn.mock.calls.map(([line]) => String(line));
    expect(lines.some((line) => line.includes('matched only as a SUBSTRING'))).toBe(true);
    expect(lines.some((line) => line.includes('16.0 and 16.1'))).toBe(true);
});
