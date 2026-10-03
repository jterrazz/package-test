import { content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('clock', () => {
    test('a script reading Date sees the instant the chain stated', async () => {
        // Given - a page whose script stamps the moment it opened
        const result = await website.clock('2026-03-04T09:30:00Z').visit('/clock');

        // Then - the stamp is the stated instant, not the run's
        expect(result.content.text).toContain('2026-03-04T09:30:00.000Z');
    });

    test('a view made with() pins every visit it starts', async () => {
        // Given - the instant a whole file shares
        const result = await website.with({ clock: '2026-03-04T09:30:00Z' }).visit('/clock');

        // Then - the stamp is the stated instant
        expect(result.content.text).toContain('2026-03-04T09:30:00.000Z');
    });

    test('refuses a clock that is not an instant, in the words the chain wrote', async () => {
        // Given - a chain stated with something that is not an instant
        const stated = website.clock('soon');

        // Then - the visit is refused before the page opens, naming what an instant looks like
        await expect(stated.visit('/clock')).rejects.toThrow(
            [
                'found: .clock("soon"), and "soon" is not an instant',
                'why: A clock is pinned at an instant, written as an ISO-8601 string.',
                "fix: pass an ISO-8601 string: .clock('2026-03-04T09:30:00Z')",
                'read: docs/19-time-and-doubles.md#the-clock',
            ].join('\n'),
        );
    });

    test('a raw exchange refuses the setup rather than ignoring it', async () => {
        // Given - a chain pinning a clock, then asking for one raw exchange
        // Then - the refusal says a fetch opens no page
        await expect(website.clock('2026-03-04T09:30:00Z').fetch('/clock')).rejects.toThrow(
            [
                'found: .clock() on a chain ending in .fetch(), which opens no page',
                'why: .clock() pins the clock of a page, and .fetch() is one raw HTTP exchange.',
                'fix: assert the moment with a token ({{iso8601}}) in the golden, or visit the page',
                'read: docs/10-website.md#setup-clock',
            ].join('\n'),
        );
    });

    test('the page reads its own calendar again on the next visit', async () => {
        // Given - a visit that pinned nothing, after one that did
        await website.clock('2026-03-04T09:30:00Z').visit('/clock');
        const result = await website.visit('/clock', async (visitor) => {
            await visitor.see(content('Clock'));
        });

        // Then - the stamp moved on: the pin lasted exactly one chain
        expect(result.content.text).not.toContain('2026-03-04T09:30:00.000Z');
    });
});
