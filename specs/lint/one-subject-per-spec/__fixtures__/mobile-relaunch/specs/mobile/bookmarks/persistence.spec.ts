import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('persistence', () => {
    test('a bookmark outlives a relaunch', async () => {
        // Given - an event bookmarked from the feed
        await mobile.open('acme://feed', async ({ tap }) => {
            await tap('Bookmark');
        });

        // Then - the library still holds it after the app relaunched
        const result = await mobile.open('acme://library');
        expect(result.content.text).toContain('Bookmarked');
    });
});
