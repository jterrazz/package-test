import { component, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { LocaleNote } from './locale-note.js';

test('renders under the timezone, the locale and the page size the project states', async () => {
    // Given - no chain setup: every value comes from the component project in vitest.config.ts
    const result = await component.render(<LocaleNote />, async (visitor) => {
        await visitor.see(content('Europe/Paris'));
    });

    // Then - the context is the project's, not the defaults (UTC, en-US, 1280×720)
    expect(result.content.text).toContain('fr-FR');
    expect(result.content.text).toContain('1024×640');
});

test("reads the project's instant when the chain pins none", async () => {
    // Given - a render with no .clock() of its own
    const result = await component.render(<LocaleNote />, async (visitor) => {
        await visitor.see(content('2026-01-02T03:04:05.000Z'));
    });

    // Then - the page's Date is on the project's clock
    expect(result.content.text).toContain('2026-01-02T03:04:05.000Z');
});
