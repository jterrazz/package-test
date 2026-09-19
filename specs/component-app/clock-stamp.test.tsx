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

test('asks an iterable for membership, the way the node build does', async () => {
    // Given - a render, which is what registers the page's own matchers
    const result = await component.clock('2026-03-04T09:30:00.000Z').render(<ClockStamp />);

    // Then - the accessor is the framework's; an array and a Set are vitest's,
    // And they mean here exactly what they mean in a module test
    expect(result.content).toContain('2026-03-04');
    expect(['ab', 'cd']).not.toContain('b');
    expect(new Set([1])).toContain(1);
});

test('refuses a subject neither the framework nor vitest can read', async () => {
    // Given - the same registered matchers
    await component.render(<ClockStamp />);

    // Then - a string still matches, and a number is refused in the node build's words
    expect('hexagonal').toMatch(/^hex/u);
    expect(() => {
        expect(42).toContain('4');
    }).toThrow(/stream accessor, string, or iterable/u);
});
