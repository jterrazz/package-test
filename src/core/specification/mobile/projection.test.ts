import { describe, expect, test } from 'vitest';

import { EVENTS_SCREEN_SOURCE, FORM_SCREEN_SOURCE } from './projection.fixtures.js';
import { projectScreen } from './projection.js';

describe('projectScreen', () => {
    test('collapses the wrapper towers into a flat, labeled tree', () => {
        // Given - a real events screen: dozens of unlabeled Other/Window layers
        const { tree } = projectScreen(EVENTS_SCREEN_SOURCE);

        // Then - only the application root and the labeled nodes survive
        expect(tree).toEqual({
            children: [
                { label: 'Signals', type: 'StaticText' },
                { label: 'Événements', type: 'Other' },
                { label: 'Articles', type: 'Other' },
                { label: 'Conflit militaire États-Unis Iran 2026', type: 'Button' },
                { label: "Guerre d'Ukraine", type: 'Button' },
                { label: 'Enquête Fauci COVID-19', type: 'Button' },
                { label: "Cyberattaque sur systèmes d'eau Minnesota", type: 'Button' },
            ],
            label: 'SigNews',
            type: 'Application',
        });
    });

    test('strips the XCUIElementType prefix from every type name', () => {
        // Given - the projected events screen
        const { tree } = projectScreen(EVENTS_SCREEN_SOURCE);

        // Then - types read as their bare role names
        expect(tree.type).toBe('Application');
        const prefixed = tree.children?.filter((node) => node.type.includes('XCUIElementType'));
        expect(prefixed).toEqual([]);
    });

    test('drops a child that merely repeats its parent accessibility element', () => {
        // Given - the "Signals" StaticText, which XCUITest nests inside itself
        const { tree } = projectScreen(EVENTS_SCREEN_SOURCE);

        // Then - it survives once, childless
        const signals = tree.children?.filter((node) => node.label === 'Signals');
        expect(signals).toEqual([{ label: 'Signals', type: 'StaticText' }]);
    });

    test('keeps off-screen rows — the tree describes the whole mounted list', () => {
        // Given - a list row below the fold (visible="false" in the source)
        const { texts, tree } = projectScreen(EVENTS_SCREEN_SOURCE);

        // Then - the tree carries it, the visible texts do not
        const labels = tree.children?.map((node) => node.label);
        expect(labels).toContain("Cyberattaque sur systèmes d'eau Minnesota");
        expect(texts).not.toContain("Cyberattaque sur systèmes d'eau Minnesota");
    });

    test('collects the visible texts in document order without repeats', () => {
        // Given - the events screen, whose nested StaticText repeats its label
        const { texts } = projectScreen(EVENTS_SCREEN_SOURCE);

        // Then - one entry per rendered text, app chrome excluded
        expect(texts).toEqual([
            'Signals',
            'Événements',
            'Articles',
            'Conflit militaire États-Unis Iran 2026',
            "Guerre d'Ukraine",
            'Enquête Fauci COVID-19',
        ]);
    });

    test('keeps a value and an identifier only when they add information', () => {
        // Given - a text field whose value and identifier differ from the label
        const { tree } = projectScreen(FORM_SCREEN_SOURCE);

        // Then - both travel; the button keeps its identifier, labels stay decoded
        expect(tree.children).toEqual([
            {
                identifier: 'email-field',
                label: 'Email & login',
                type: 'TextField',
                value: 'a@b.test',
            },
            { identifier: 'submit', label: "S'abonner", type: 'Button' },
        ]);
    });

    test('refuses a source with no element at all', () => {
        // Given - an empty capture
        // Then - the failure names the projection, not a downstream accessor
        expect(() => projectScreen('<?xml version="1.0"?>')).toThrow(
            'the page source contains no XML element',
        );
    });
});
