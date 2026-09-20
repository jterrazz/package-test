// oxlint-disable-next-line jterrazz/j2-no-sleep -- the subject IS the clock: proving `clock.run()` takes the scheduler needs a REAL delay to contrast with the frozen one, which no framework primitive can stand in for
import { setTimeout as afterRealMs } from 'node:timers/promises';
import { describe, expect, test } from 'vitest';

import { clock } from './clock.js';

describe('clock — the one time primitive', () => {
    test('pins the calendar at the stated instant', () => {
        // Given - the clock taken at a named instant
        using _ = clock.at('2026-03-04T09:30:00Z');

        // Then - every reading of the calendar is that instant
        expect(new Date().toISOString()).toBe('2026-03-04T09:30:00.000Z');
        expect(Date.now()).toBe(Date.parse('2026-03-04T09:30:00Z'));
    });

    test('gives the calendar back when the scope ends', () => {
        // Given - a scope that took the clock and ended
        {
            using _ = clock.at('2026-03-04T09:30:00Z');
        }

        // Then - the reading is the real one again
        expect(new Date().toISOString()).not.toBe('2026-03-04T09:30:00.000Z');
    });

    test('leaves the scheduler alone so a subject keeps running', async () => {
        // Given - a pinned calendar and a promise the real scheduler resolves
        using _ = clock.at('2026-03-04T09:30:00Z');
        const settled = await afterRealMs(1, 'ran');

        // Then - the subject ran on its own while the calendar stayed still
        expect(settled).toBe('ran');
        expect(new Date().toISOString()).toBe('2026-03-04T09:30:00.000Z');
    });

    test('moves the pinned calendar forward on advance', async () => {
        // Given - a pinned clock moved on by a minute
        using _ = clock.at('2026-03-04T09:30:00Z');
        await clock.advance(60_000);

        // Then - the calendar reads a minute later
        expect(new Date().toISOString()).toBe('2026-03-04T09:31:00.000Z');
    });

    test('fires what came due when the scheduler belongs to the test', async () => {
        // Given - the scheduler taken, and work scheduled five seconds out
        using _ = clock.run('2026-03-04T09:30:00Z');
        let fired = 'not yet';
        // oxlint-disable-next-line jterrazz/j2-no-sleep -- the work this schedules is the test's Given: `clock.advance()` is what fires it, so the timer is the subject, not a sleep
        setTimeout(() => {
            fired = new Date().toISOString();
        }, 5000);

        // Then - nothing ran until the clock was advanced past it
        expect(fired).toBe('not yet');
        await clock.advance(5000);
        expect(fired).toBe('2026-03-04T09:30:05.000Z');
    });

    test('refuses to advance a clock nobody took', async () => {
        // Given - no pinned clock
        // Then - advancing says which primitive to take first
        await expect(clock.advance(1000)).rejects.toThrow('no clock is pinned');
    });

    test('refuses an instant that is not one', () => {
        // Given - a string that names no instant
        // Then - the refusal shows the shape it wanted
        expect(() => clock.at('yesterday')).toThrow('is not an instant');
    });

    test('a second clock taken inside the first is refused, not nested', () => {
        // Given - a scope that already holds the scheduler
        using _ = clock.run('2026-03-04T09:30:00Z');

        // Then - the inner one says so: disposing it would give back the REAL clock, not the outer scope's, and end a pin the test still needs
        expect(() => clock.at('2026-03-05T00:00:00Z')).toThrow('a clock is already pinned');
    });
});
