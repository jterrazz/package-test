import { describe, expect, test } from 'vitest';

import { navigation } from '../../../visitor/targets/landmarks.js';
import { button, content, field, testId } from '../../../visitor/targets/roles.js';
import { element } from './appium.adapter.fixtures.js';
import type { DeviceLog } from './appium.adapter.fixtures.js';
import {
    captureMatches,
    compilePredicate,
    onScreenLabels,
    scrollToOffscreen,
} from './xcui-query.js';

/** Cast at the seam: a fake implements the calls a query makes, never webdriverio's whole types. */
function asList(elements: unknown): never {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a fake list implements the reads a capture makes
    return elements as never;
}

const asDriver = asList;

/** What scrolling to the Pay button sent a screen holding the found elements. */
async function scrolled(found: string[], refusing = false): Promise<DeviceLog> {
    const log: DeviceLog = [];
    const screen = {
        $$: async () => await Promise.resolve(found.map((id) => element(log, id))),
        executeScript: async (script: string, [argument]: unknown[]) => {
            log.push(`${script} ${JSON.stringify(argument)}`);
            await (refusing ? Promise.reject(new Error('not scrollable')) : Promise.resolve());
        },
    };
    await scrollToOffscreen(asDriver(screen), asDriver(screen), button('Pay'));
    return log;
}

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
            new Error(
                [
                    "found: navigation(), a landmark — an iOS screen has no 'navigation' region",
                    'why: An iOS screen has no ARIA landmark: a mobile verb is scoped with `within(testId(…), …)`.',
                    "fix: scope with within(testId('…'), …) — any target works as the scope",
                    'read: docs/24-linting.md#no-landmark-on-mobile',
                ].join('\n'),
            ),
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

    test('a match is reported by its bare type and what it carries beyond its label, the first ten of them', async () => {
        // Given - twelve elements: a button, one carrying nothing, a field whose value alone speaks, a cell echoing its label, a long label, then more
        const log: DeviceLog = [];
        const listed = [
            element(log, '1', { label: 'Pay', type: 'XCUIElementTypeButton' }),
            element(log, '2'),
            element(log, '3', {
                label: '',
                name: '',
                type: 'XCUIElementTypeTextField',
                value: 'a@b.test',
            }),
            element(log, '4', {
                label: 'Same',
                name: 'Same',
                type: 'XCUIElementTypeCell',
                value: 'Same',
            }),
            element(log, '5', { label: `${'word '.repeat(20)}end`, name: 'row-5', type: 'Other' }),
            element(log, '6', {
                label: 'Email',
                name: '',
                type: 'XCUIElementTypeTextField',
                value: '',
            }),
            ...Array.from({ length: 6 }, (_, index) =>
                element(log, `${index + 7}`, { label: `Row ${index + 7}` }),
            ),
        ];

        // When - they are captured
        const captured = await captureMatches(asList(listed));

        // Then - ten reports, each as it reads
        expect(captured).toStrictEqual([
            { label: 'Pay', type: 'Button' },
            { type: 'Unknown' },
            { type: 'TextField', value: 'a@b.test' },
            { label: 'Same', type: 'Cell' },
            { identifier: 'row-5', label: 'word '.repeat(16), type: 'Other' },
            { label: 'Email', type: 'TextField' },
            ...Array.from({ length: 4 }, (_, index) => ({
                label: `Row ${index + 7}`,
                type: 'Unknown',
            })),
        ]);
    });

    test('an element found off screen is scrolled to by its id, a scroll refused is no failure, and nothing found scrolls nothing', async () => {
        // Given - a screen holding the button off screen, one refusing to scroll, and one without it
        // Then - one scroll to the found id each time it was found
        expect([
            await scrolled(['pay', 'other']),
            await scrolled(['pay'], true),
            await scrolled([]),
        ]).toStrictEqual([
            ['mobile: scrollToElement {"elementId":"pay"}'],
            ['mobile: scrollToElement {"elementId":"pay"}'],
            [],
        ]);
    });
});
