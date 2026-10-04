import { describe, expect, test } from 'vitest';

import { asWritten } from './as-written.js';
import { main, navigation, region, within } from './landmarks.js';
import { content, link } from './roles.js';

describe('asWritten', () => {
    test('asWritten — renders a target as the source that would build it', () => {
        // Given - a plain named target
        const target = link('Articles');

        // Then - the error speaks the caller's vocabulary, not playwright's
        expect(asWritten(target)).toBe('link("Articles")');
    });

    test('asWritten — renders the exact option', () => {
        // Given - a target asking for a whole-name match
        const target = link('Articles', { exact: true });

        // Then - the option is echoed as written
        expect(asWritten(target)).toBe('link("Articles", { exact: true })');
    });

    test('asWritten — renders an anonymous landmark without arguments', () => {
        // Given - a landmark carrying no accessible name
        const target = main();

        // Then - no name is invented for it, an empty one or a blank argument
        expect([target, asWritten(target), asWritten({ exact: true, kind: 'main' })]).toStrictEqual(
            [{ kind: 'main' }, 'main()', 'main({ exact: true })'],
        );
    });

    test('asWritten — renders a scope as the within() call that produced it', () => {
        // Given - a scoped target
        const target = within(navigation(), link('Articles'));

        // Then - the rendering round-trips to source the author could paste
        expect(asWritten(target)).toBe('within(navigation(), link("Articles"))');
    });

    test('asWritten — renders a nested scope outside-in', () => {
        // Given - a target scoped twice
        const inner = within(region('Series'), link('Part 2'));
        const target = within(main(), inner);

        // Then - the chain reads from the outermost container inward
        expect(asWritten(target)).toBe('within(within(main(), region("Series")), link("Part 2"))');
    });

    test('asWritten — speaks content() for the text kind', () => {
        // Given - a target built by content(), whose kind is text
        const target = content('Hello');

        // Then - the author's function is named, never the kind
        expect(asWritten(target)).toBe('content("Hello")');
    });
});
