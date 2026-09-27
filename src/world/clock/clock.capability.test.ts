import { describe, expect, test, vi } from 'vitest';

import { defineAction } from '../../kernel/chain/action.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { clock } from './clock.capability.js';
import type { ClockMethod } from './clock.capability.js';
import type { ClockPort } from './clock.port.js';
import { processClock } from './process-clock.adapter.js';

type Chain = { clock: ClockMethod<Chain>; now: () => Promise<string> };

const now = defineAction({
    accessors: [],
    name: 'now',
    perform: async () => await Promise.resolve(new Date().toISOString()),
    row: { group: 'Terminal action', name: '.now()', probe: '.now(' },
});

function chain(adapter: ClockPort = processClock): Chain {
    return defineFacet<Chain>()({
        actions: [now],
        capabilities: [clock],
        adapters: () => ({ clock: adapter }),
        locate: () => '/specs',
        options: {},
    }).open({});
}

describe('clock', () => {
    test('.clock() — the calendar a chain pins — pins the instant for the action alone', async () => {
        // Given - a chain pinned at an instant
        const pinned = await chain().clock('2026-03-04T09:30:00.000Z').now();

        // Then - the action read the instant, and the real calendar is back once it settled
        expect({ pinned, stillPinned: vi.isFakeTimers() }).toStrictEqual({
            pinned: '2026-03-04T09:30:00.000Z',
            stillPinned: false,
        });
    });

    test('.clock() — the calendar a chain pins — judges the instant when the chain is armed, whatever the adapter pins', async () => {
        // Given - a chain stated with something that is not an instant, on an adapter that pins nothing
        const stated = chain({ pin: () => ({}) }).clock('soon');

        // Then - stating it passed; running it is refused in the calendar's own words
        await expect(stated.now()).rejects.toThrow('"soon" is not an instant');
    });
});
