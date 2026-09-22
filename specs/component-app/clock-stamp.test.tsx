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
    expect(result.content.text).toContain('Rendered at 2026-03-04T09:30:00.000Z');
});

test('asks an iterable for membership, the way the node build does', async () => {
    // Given - a render, which is what registers the page's own matchers
    const result = await component.clock('2026-03-04T09:30:00.000Z').render(<ClockStamp />);

    // Then - the accessor is the framework's; an array and a Set are vitest's, and they mean here exactly what they mean in a module test
    expect(result.content.text).toContain('2026-03-04');
    expect(['ab', 'cd']).not.toContain('b');
    expect(new Set([1])).toContain(1);
});

test("leaves toContain to vitest: a string is a substring, and a stream's text is one", async () => {
    // Given - the page's registered matchers
    const result = await component.render(<ClockStamp />);

    // Then - no override answers: vitest's substring check, on a string and on the comparable text
    expect('hexagonal').toContain('agon');
    expect(result.content.text).not.toContain('\u001B[');
});
