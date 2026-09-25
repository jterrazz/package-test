import { describe, expect, test } from 'vitest';

import { link, main, navigation, region, within } from './elements.js';
import { formatElement } from './spelling.js';

describe('spelling', () => {
    test('formatElement — renders a descriptor as the source that would build it', () => {
        // Given - a plain named descriptor
        const element = link('Articles');

        // Then - the error speaks the caller's vocabulary, not playwright's
        expect(formatElement(element)).toBe('link("Articles")');
    });

    test('formatElement — renders the exact option', () => {
        // Given - a descriptor asking for a whole-name match
        const element = link('Articles', { exact: true });

        // Then - the option is echoed as written
        expect(formatElement(element)).toBe('link("Articles", { exact: true })');
    });

    test('formatElement — renders an anonymous landmark without arguments', () => {
        // Given - a landmark carrying no accessible name
        const element = main();

        // Then - no empty string is invented for it
        expect(formatElement(element)).toBe('main()');
    });

    test('formatElement — renders a scope as the within() call that produced it', () => {
        // Given - a scoped descriptor
        const element = within(navigation(), link('Articles'));

        // Then - the rendering round-trips to source the author could paste
        expect(formatElement(element)).toBe('within(navigation(), link("Articles"))');
    });

    test('formatElement — renders a nested scope outside-in', () => {
        // Given - a target scoped twice
        const inner = within(region('Series'), link('Part 2'));
        const element = within(main(), inner);

        // Then - the chain reads from the outermost container inward
        expect(formatElement(element)).toBe(
            'within(within(main(), region("Series")), link("Part 2"))',
        );
    });
});
