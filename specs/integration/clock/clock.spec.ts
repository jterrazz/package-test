import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { stamp } from '../_fixtures/orders/stamp.js';
import { integration } from '../pure.specification.js';

describe('clock', () => {
    test('stamps the instant the chain stated', async () => {
        // Given - a module that stamps the moment it ran
        const result = await integration.clock('2026-03-04T09:30:00Z').call(stamp);

        // Then - the stamp is that instant, not the run's
        expect(result.value).toMatch(file('./_expected/stamped.json'));
    });

    test('a view made with() pins every call it starts', async () => {
        // Given - the instant a whole file shares
        const result = await integration.with({ clock: '2026-03-04T09:30:00Z' }).call(stamp);

        // Then - the stamp is that instant
        expect(result.value).toMatch(file('./_expected/stamped.json'));
    });

    test('gives the calendar back to the next chain', async () => {
        // Given - a chain that pinned nothing, after one that did
        await integration.clock('2026-03-04T09:30:00Z').call(stamp);
        const result = await integration.call(stamp);

        // Then - the reading moved on: the pin lasted exactly one chain
        expect(result.value).not.toMatch(file('./_expected/stamped.json'));
    });
});
