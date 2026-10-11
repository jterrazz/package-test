import { describe, expect, test } from 'vitest';

import { storage } from '../storage.capability.js';

const SETUP = { adapters: {}, config: {} };

describe('storage', () => {
    test('storage.capability — .storage() — states nothing until called, and the last call replaces the earlier', () => {
        // Given - a chain that seeds, then blocks, and one that seeds twice
        const blocked = storage.reduce(
            storage.reduce(storage.initial, [{ local: { theme: 'dark' } }], SETUP),
            ['throws'],
            SETUP,
        );
        const reseeded = storage.reduce(
            storage.reduce(storage.initial, [{ local: { theme: 'dark' } }], SETUP),
            [{ session: { draft: 'a' } }],
            SETUP,
        );

        // Then - nothing stated is null, and the last statement wins whole, never merged with the earlier
        expect([storage.initial, blocked, reseeded]).toStrictEqual([
            null,
            'throws',
            { session: { draft: 'a' } },
        ]);
    });
});
