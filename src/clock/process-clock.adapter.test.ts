import { describe, expect, test, vi } from 'vitest';

import { processClock } from './process-clock.adapter.js';

describe('processClock', () => {
    test('process-clock.adapter — the clock of this process — pins it at the instant stated until released, and pins nothing for none', () => {
        // Given - a pin at one instant, and a chain that stated none
        const armed = processClock.pin('2026-03-04T09:30:00.000Z');
        // oxlint-disable-next-line jterrazz/no-sampled-value-in-test -- the reading IS the subject: the adapter's pin is what fixes it
        const pinned = new Date().toISOString();
        armed?.release?.();

        // Then - the instant held while pinned, the clock real once released, and no pin for none
        expect([pinned, vi.isFakeTimers(), processClock.pin(null)]).toStrictEqual([
            '2026-03-04T09:30:00.000Z',
            false,
            undefined,
        ]);
    });
});
