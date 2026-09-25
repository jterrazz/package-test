import { component, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { CaptureNote } from './capture-note.js';

test('captures the text the page renders, not everything the document holds', async () => {
    // Given - a component carrying a stylesheet and a node it does not display
    const result = await component.render(<CaptureNote />, async (visitor) => {
        await visitor.see(content('Shown to the reader'));
    });

    // Then - `content` is what a reader sees; the markup keeps the rest
    expect(result.content.text).not.toContain('rebeccapurple');
    expect(result.content.text).not.toContain('Drafted, never shown');
    expect(result.html.text).toContain('Drafted, never shown');
});

test('asks an iterable for membership, the way the node build does', async () => {
    // Given - a render, which is what registers the page's own matchers
    const result = await component.render(<CaptureNote />);

    // Then - the accessor is the framework's; an array and a Set are vitest's, and they mean here exactly what they mean in a module test
    expect(result.content.text).toContain('Shown to the reader');
    expect(['ab', 'cd']).not.toContain('b');
    expect(new Set([1])).toContain(1);
});

test("leaves toContain to vitest: a string is a substring, and a stream's text is one", async () => {
    // Given - the page's registered matchers
    const result = await component.render(<CaptureNote />);

    // Then - no override answers: vitest's substring check, on a string and on the comparable text
    expect('hexagonal').toContain('agon');
    expect(result.content.text).not.toContain('\u001B[');
});
