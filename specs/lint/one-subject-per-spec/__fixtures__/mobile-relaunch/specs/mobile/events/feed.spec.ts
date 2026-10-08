import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('feed', () => {
    test('lists the events', async () => {
        // Then - the feed
        const result = await mobile.open('acme://events');
        expect(result.content.text).toContain('Events');
    });

    test('opens a dossier', async () => {
        // Then - the dossier
        const result = await mobile.open('acme://dossier/42');
        expect(result.content.text).toContain('Dossier');
    });
});
