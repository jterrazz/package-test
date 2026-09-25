import { clock, component, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { ClockStamp } from './clock-stamp.js';

describe('ClockStamp', () => {
    test('reads the instant the chain pinned, not the machine clock', async () => {
        // Given - a component that stamps the moment it rendered, under a frozen clock
        const result = await component
            .clock('2026-03-04T09:30:00.000Z')
            .render(<ClockStamp />, async (visitor) => {
                await visitor.see(content('Rendered at 2026-03-04T09:30:00.000Z'));
            });

        // Then - the stamp is the instant the spec named, to the millisecond
        expect(result.content.text).toContain('Rendered at 2026-03-04T09:30:00.000Z');
    });

    test('refuses a clock that is not an instant, in the words a node chain uses', async () => {
        // Given - a chain stated with something that is not an instant
        const stated = component.clock('soon');

        // Then - the render is refused before anything mounts, naming what an instant looks like
        await expect(stated.render(<ClockStamp />)).rejects.toThrow(
            `clock.at(): "soon" is not an instant — pass an ISO-8601 string (e.g. '2026-03-04T09:30:00Z').`,
        );
    });

    test("reads the project's instant when the chain pins none", async () => {
        // Given - a render with no .clock() of its own
        const result = await component.render(<ClockStamp />, async (visitor) => {
            await visitor.see(content('Rendered at 2026-01-02T03:04:05.000Z'));
        });

        // Then - the page's Date is on the project's clock
        expect(result.content.text).toContain('Rendered at 2026-01-02T03:04:05.000Z');
    });

    test('the page clock is pinned by the name a module test uses', () => {
        // Given - a scope that freezes the page's own calendar
        using _ = clock.at('2026-03-04T09:30:00Z');

        // Then - `Date` in the page answers the instant the scope stated
        expect(new Date().toISOString()).toBe('2026-03-04T09:30:00.000Z');
    });
});
