import { describe, expect, test } from 'vitest';

import { navigation } from '../../../visitor/targets/landmarks.js';
import { button, content, field, testId } from '../../../visitor/targets/roles.js';
import { compilePredicate, onScreenLabels } from './xcui-query.js';

describe('xcui-query', () => {
    test.each([
        {
            expected: "type == 'XCUIElementTypeButton' AND label == 'Save' AND visible == 1",
            target: button('Save'),
        },
        {
            expected:
                "type IN {'XCUIElementTypeTextField','XCUIElementTypeSecureTextField'} AND (label == 'Email' OR value == 'Email') AND visible == 1",
            target: field('Email'),
        },
        {
            expected: "(label CONTAINS 'Welc' OR value CONTAINS 'Welc') AND visible == 1",
            target: content('Welc', { exact: false }),
        },
        { expected: "name == 'save-row' AND visible == 1", target: testId('save-row') },
        {
            expected: String.raw`type == 'XCUIElementTypeButton' AND label == 'it\'s a back\\slash' AND visible == 1`,
            target: button(String.raw`it's a back\slash`),
        },
    ])('compiles $target.kind "$target.name" to its XCUITest predicate', ({ expected, target }) => {
        // Given - a target as a scenario writes it
        // Then - the predicate names the element type, its name as written, and only visible ones
        expect(compilePredicate(target)).toBe(expected);
    });

    test('a predicate for the scroll fallback admits offscreen elements', () => {
        // Given - the save button, looked up past the visible screen
        // Then - visibility is no longer a condition
        expect(compilePredicate(button('Save'), { anyVisibility: true })).toBe(
            "type == 'XCUIElementTypeButton' AND label == 'Save' AND 1 == 1",
        );
    });

    test('a landmark is refused, not approximated', () => {
        // Given - a navigation landmark
        // Then - an iOS screen has no navigation region to compile
        expect(() => compilePredicate(navigation())).toThrow(
            /a landmark — an iOS screen has no 'navigation' region/u,
        );
    });

    test('the labels on screen are listed once each, the first fifteen', () => {
        // Given - a page source repeating one label and carrying twenty more
        const many = Array.from({ length: 20 }, (_, index) => `label="Row ${index}"`);
        const source = ['label="Home"', 'label="Home"', 'label="x"', ...many].join(' ');

        // Then - duplicates and one-character labels are dropped, and the list stops at fifteen
        expect(onScreenLabels(source)).toStrictEqual([
            'Home',
            ...Array.from({ length: 14 }, (_, index) => `Row ${index}`),
        ]);
    });
});
