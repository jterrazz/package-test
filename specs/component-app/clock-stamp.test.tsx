import { component, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { ClockStamp } from './clock-stamp.js';

test('reads the instant the chain pinned, not the machine clock', async () => {
    // Given - a component that stamps the moment it rendered, under a frozen clock
    const result = await component
        .clock('2026-03-04T09:30:00.000Z')
        .render(<ClockStamp />, async (visitor) => {
            await visitor.see(content('Rendered at 2026-03-04T09:30:00.000Z'));
        });

    // Then - the stamp is the instant the spec named, to the millisecond
    expect(result.content).toContain('Rendered at 2026-03-04T09:30:00.000Z');
});
