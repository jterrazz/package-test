import { describe, expect, test } from 'vitest';

import { integration } from '../pure.specification.js';

describe('integration — the calendar the module reads', () => {
    test('stamps the instant the chain stated', async () => {
        // Given - a module that stamps the moment it ran
        const result = await integration
            .clock('2026-03-04T09:30:00Z')
            .call(() => ({ stampedAt: new Date().toISOString() }));

        // Then - the stamp is that instant, not the run's
        expect(result.value).toMatch('stamped.json');
    });

    test('gives the calendar back to the next chain', async () => {
        // Given - a chain that pinned nothing, after one that did
        await integration
            .clock('2026-03-04T09:30:00Z')
            .call(() => ({ stampedAt: new Date().toISOString() }));
        const result = await integration.call(() => ({ stampedAt: new Date().toISOString() }));

        // Then - the reading moved on: the pin lasted exactly one chain
        expect(result.value).not.toMatch('stamped.json');
    });
});
