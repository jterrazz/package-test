import { describe, expect, test } from 'vitest';

import { projectScreen } from '../projection.js';
import {
    EVENTS_SCREEN_SOURCE,
    FORM_SCREEN_SOURCE,
    NESTED_SCREEN_SOURCE,
} from './projection.fixtures.js';

describe('projectScreen', () => {
    test('collapses the wrapper towers into a flat, labeled tree, and collects the visible texts in order without repeats', () => {
        // Given - a real events screen: dozens of unlabeled Other/Window layers, a StaticText nested in itself, a row below the fold
        const screen = projectScreen(EVENTS_SCREEN_SOURCE);

        // Then - the application root and the labeled nodes, each once; the texts on screen, app chrome excluded
        expect(screen).toStrictEqual({
            texts: [
                'Signals',
                'Événements',
                'Articles',
                'Conflit militaire États-Unis Iran 2026',
                "Guerre d'Ukraine",
                'Jazz night at the harbour',
            ],
            tree: {
                children: [
                    { label: 'Signals', type: 'StaticText' },
                    { label: 'Événements', type: 'Other' },
                    { label: 'Articles', type: 'Other' },
                    { label: 'Conflit militaire États-Unis Iran 2026', type: 'Button' },
                    { label: "Guerre d'Ukraine", type: 'Button' },
                    { label: 'Jazz night at the harbour', type: 'Button' },
                    { label: "Cyberattaque sur systèmes d'eau Minnesota", type: 'Button' },
                ],
                label: 'SigNews',
                type: 'Application',
            },
        });
    });

    test('keeps a value and an identifier only when they add information', () => {
        // Given - a text field whose value and identifier differ from the label
        const { tree } = projectScreen(FORM_SCREEN_SOURCE);

        // Then - both travel; the button keeps its identifier, labels stay decoded
        expect(tree.children).toStrictEqual([
            {
                identifier: 'email-field',
                label: 'Email & login',
                type: 'TextField',
                value: 'a@b.test',
            },
            { identifier: 'submit', label: "S'abonner", type: 'Button' },
        ]);
    });

    test('a node with an identifier or a value alone is kept with its children, and a child repeats its parent only when it matches it whole', () => {
        // Given - a cell known by its identifier, a slider by its value, and children that differ from them by one field each
        const screen = projectScreen(NESTED_SCREEN_SOURCE);

        // Then - the empty attributes count as none, the entities decode, and only the exact childless repeats go
        expect(screen).toStrictEqual({
            texts: ['Row AB'],
            tree: {
                children: [
                    {
                        children: [
                            { label: 'Row AB', type: 'StaticText' },
                            {
                                children: [{ label: 'x', type: 'Other' }],
                                identifier: 'row-1',
                                type: 'Cell',
                            },
                        ],
                        identifier: 'row-1',
                        type: 'Cell',
                    },
                    {
                        children: [
                            { type: 'Other', value: '50%' },
                            { type: 'Slider', value: '60%' },
                            { identifier: 'thumb', type: 'Slider', value: '50%' },
                            { label: 'Volume', type: 'Slider', value: '50%' },
                        ],
                        type: 'Slider',
                        value: '50%',
                    },
                ],
                label: 'App',
                type: 'Application',
            },
        });
    });

    test('the Appium envelope is opened only when it wraps one application', () => {
        // Given - an envelope around two applications, an empty one, and an application of one child
        const sources = [
            '<AppiumAUT><XCUIElementTypeApplication label="A"/><XCUIElementTypeApplication label="B"/></AppiumAUT>',
            '<AppiumAUT/>',
            '<XCUIElementTypeApplication label="A"><XCUIElementTypeButton label="B"/></XCUIElementTypeApplication>',
        ];

        // Then - each stays the root
        expect(sources.map((source) => projectScreen(source).tree)).toStrictEqual([
            {
                children: [
                    { label: 'A', type: 'Application' },
                    { label: 'B', type: 'Application' },
                ],
                type: 'AppiumAUT',
            },
            { type: 'AppiumAUT' },
            { children: [{ label: 'B', type: 'Button' }], label: 'A', type: 'Application' },
        ]);
    });

    test('refuses a source with no element at all', () => {
        // Given - an empty capture
        // Then - the failure names the projection, not a downstream accessor
        expect(() => projectScreen('<?xml version="1.0"?>')).toThrow(
            [
                'found: the page source Appium answered holds no XML element',
                'why: A screen is read from the XML page source Appium answers.',
                'fix: restart the Appium server, or upgrade Appium and its XCUITest driver',
                'read: docs/guides/mobile-specs.md#requirements--what-the-machine-must-have',
            ].join('\n'),
        );
    });

    test('reads attributes however they are spaced, a closing tag spaced before its bracket, and every named entity', () => {
        // Given - an application whose button carries its attributes over two lines and every named entity in its label, and whose tags close with a space
        const screen = projectScreen(
            [
                '<XCUIElementTypeApplication label="App" visible="true">',
                '  <XCUIElementTypeButton  label="&apos;&gt;&lt;&quot;&amp;"',
                '      visible="true"></XCUIElementTypeButton >',
                '  <XCUIElementTypeStaticText label="after" visible="true"/>',
                '</XCUIElementTypeApplication >',
            ].join('\n'),
        );

        // Then - the button under the application, its label decoded, and the text after it beside it
        expect(screen.tree).toStrictEqual({
            children: [
                { label: `'><"&`, type: 'Button' },
                { label: 'after', type: 'StaticText' },
            ],
            label: 'App',
            type: 'Application',
        });
    });
});
