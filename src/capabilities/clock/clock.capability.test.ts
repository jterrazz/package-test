import { describe, expect, test, vi } from 'vitest';

import { defineFacet } from '../../facets/define-facet.js';
import { defineAction } from '../../model/chain/action.js';
import { processClock } from '../../seams/vitest/clock.engine.js';
import { clock } from './clock.capability.js';
import type { ClockMethod } from './clock.capability.js';

/** A chain composed of `.clock()` alone, ending on an action that reads `Date`. */
type Chain = { clock: ClockMethod<Chain>; now: () => Promise<string> };

const now = defineAction({
    accessors: [],
    name: 'now',
    perform: async () => await Promise.resolve(new Date().toISOString()),
    row: { group: 'Terminal action', name: '.now()', probe: '.now(' },
});

/** A chain whose calendar is this process's. */
function chain(): Chain {
    return defineFacet<Chain>()({
        actions: [now],
        capabilities: [clock],
        engines: () => ({ clock: processClock }),
        locate: () => '/specs',
        options: {},
    }).open({});
}

describe('.clock() — the calendar a chain pins', () => {
    test('pins the instant for the action alone', async () => {
        // Given - a chain pinned at an instant
        const pinned = await chain().clock('2026-03-04T09:30:00.000Z').now();

        // Then - the action read the instant, and the real calendar is back once it settled
        expect({ pinned, stillPinned: vi.isFakeTimers() }).toStrictEqual({
            pinned: '2026-03-04T09:30:00.000Z',
            stillPinned: false,
        });
    });

    test('judges the instant when the chain is armed, not when it is stated', async () => {
        // Given - a chain stated with something that is not an instant
        const stated = chain().clock('soon');

        // Then - stating it passed; running it is refused in the calendar's own words
        await expect(stated.now()).rejects.toThrow('"soon" is not an instant');
    });
});
