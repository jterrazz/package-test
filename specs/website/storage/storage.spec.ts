import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('storage', () => {
    test('a page finds the entries the chain seeded when its first script runs', async () => {
        // Given - a page that prints what localStorage and sessionStorage hold
        const result = await website
            .storage({ local: { theme: 'dark' }, session: { draft: 'half a post' } })
            .visit('/storage');

        // Then - both stores held the seeded entries at that moment
        expect(result.content.text).toBe('Storage\n\ndark\n\nhalf a post');
    });

    test('a page finds nothing in a store the chain did not seed', async () => {
        // Given - the same page, visited with no storage stated
        const result = await website.visit('/storage');

        // Then - both stores were empty
        expect(result.content.text).toBe('Storage\n\nnone\n\nnone');
    });

    test("a chain blocking storage makes every read of it throw the browser's own error", async () => {
        // Given - the same page, visited as by a browser that refuses site data
        const result = await website.storage('throws').visit('/storage');

        // Then - the read failed with a SecurityError, and the page said so
        expect(result.content.text).toBe('Storage\n\nSecurityError\n\nSecurityError');
    });

    test('a raw exchange refuses the setup rather than ignoring it', async () => {
        // Given - a chain seeding storage, then asking for one raw exchange
        const seeded = website.storage({ local: { theme: 'dark' } });

        // Then - the refusal says a fetch opens no page
        await expect(seeded.fetch('/storage')).rejects.toThrow(
            '.storage() on a chain ending in .fetch(), which opens no page',
        );
    });
});
