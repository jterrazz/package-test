import { describe, expect, test } from 'vitest';

import { main, navigation, within } from './landmarks.js';
import { disabled, enabled, focused, selected, valued } from './modifiers.js';
import { button, field, link, option } from './roles.js';

describe('modifiers', () => {
    test('focused — modifies a descriptor rather than replacing it', () => {
        // Given - the button a dialog should hand the keyboard back to
        const element = focused(button('Open'));

        // Then - the descriptor is the same one, asked about its focus
        expect(element).toStrictEqual({ focused: true, kind: 'button', name: 'Open' });
    });

    test('focused — survives scoping, so the keyboard can be asserted inside a landmark', () => {
        // Given - a focused link designated inside the nav
        const element = within(navigation(), focused(link('Articles')));

        // Then - both the scope and the modifier travel with it
        expect(element).toStrictEqual({
            focused: true,
            kind: 'link',
            name: 'Articles',
            scope: { kind: 'navigation' },
        });
    });

    test('disabled / enabled — modify a descriptor rather than replacing it', () => {
        // Given - the same control, asked about each direction of enablement
        // Then - one flag, two answers; the descriptor is untouched otherwise
        expect(disabled(button('Publish'))).toStrictEqual({
            disabled: true,
            kind: 'button',
            name: 'Publish',
        });
        expect(enabled(button('Publish'))).toStrictEqual({
            disabled: false,
            kind: 'button',
            name: 'Publish',
        });
    });

    test('disabled / enabled — survive scoping, so enablement can be asserted inside a landmark', () => {
        // Given - a disabled button designated inside a form
        const element = within(main(), disabled(button('Publish')));

        // Then - both the scope and the modifier travel with it
        expect(element).toStrictEqual({
            disabled: true,
            kind: 'button',
            name: 'Publish',
            scope: { kind: 'main' },
        });
    });

    test('option / selected — modifies the option a field is on rather than replacing it', () => {
        // Given - the chosen channel, named inside the field that holds it
        const element = within(field('Channel'), selected(option('LinkedIn')));

        // Then - the scope and the state travel on the one descriptor
        expect(element).toStrictEqual({
            kind: 'option',
            name: 'LinkedIn',
            scope: { kind: 'field', name: 'Channel' },
            selected: true,
        });
    });

    test('valued — carries the value the field must hold', () => {
        // Given - the title a form was filled with
        const element = valued(field('Title'), 'Launch teaser');

        // Then - the descriptor is the same one, asked about its value
        expect(element).toStrictEqual({
            kind: 'field',
            name: 'Title',
            value: 'Launch teaser',
        });
    });

    test('valued — states an empty value as emptiness, not as an absent modifier', () => {
        // Given - the field a reset left behind
        const element = valued(field('Title'), '');

        // Then - the empty string is the value asked about
        expect(element.value).toBe('');
    });
});
