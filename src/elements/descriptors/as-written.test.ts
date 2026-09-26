import { describe, expect, test } from 'vitest';

import { asWritten } from './as-written.js';
import { main, navigation, region, within } from './landmarks.js';
import { link } from './roles.js';

describe('asWritten', () => {
    test('asWritten — renders a descriptor as the source that would build it', () => {
        // Given - a plain named descriptor
        const element = link('Articles');

        // Then - the error speaks the caller's vocabulary, not playwright's
        expect(asWritten(element)).toBe('link("Articles")');
    });

    test('asWritten — renders the exact option', () => {
        // Given - a descriptor asking for a whole-name match
        const element = link('Articles', { exact: true });

        // Then - the option is echoed as written
        expect(asWritten(element)).toBe('link("Articles", { exact: true })');
    });

    test('asWritten — renders an anonymous landmark without arguments', () => {
        // Given - a landmark carrying no accessible name
        const element = main();

        // Then - no empty string is invented for it
        expect(asWritten(element)).toBe('main()');
    });

    test('asWritten — renders a scope as the within() call that produced it', () => {
        // Given - a scoped descriptor
        const element = within(navigation(), link('Articles'));

        // Then - the rendering round-trips to source the author could paste
        expect(asWritten(element)).toBe('within(navigation(), link("Articles"))');
    });

    test('asWritten — renders a nested scope outside-in', () => {
        // Given - a target scoped twice
        const inner = within(region('Series'), link('Part 2'));
        const element = within(main(), inner);

        // Then - the chain reads from the outermost container inward
        expect(asWritten(element)).toBe('within(within(main(), region("Series")), link("Part 2"))');
    });
});
