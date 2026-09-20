import { describe, expect, test } from 'vitest';

import { accessibleNameIn } from './aria-name.js';

describe('the accessible name an ARIA snapshot states', () => {
    test('reads the name of the node the snapshot describes', () => {
        // Given - the snapshot of a button whose text glues to "Experiments9"
        const name = accessibleNameIn('- button "Experiments 9"');

        // Then - the name is the one the browser computed, which is what a descriptor matches
        expect(name).toBe('Experiments 9');
    });

    test('reads it through the colon a node with children carries', () => {
        // Given - a link whose snapshot continues into its own attributes
        const name = accessibleNameIn('- link "Proof of authorship Fetching…":\n  - /url: /x');

        // Then - only the first line answers, and the trailing colon is not part of the name
        expect(name).toBe('Proof of authorship Fetching…');
    });

    test('reads the label a field is named by, which is nowhere in its text', () => {
        // Given - a textbox named by the label beside it
        const name = accessibleNameIn('- textbox "Journal entry"');

        // Then - the name to write is the label
        expect(name).toBe('Journal entry');
    });

    test('says nothing for a node that has TEXT and no name', () => {
        // Given - a paragraph, whose snapshot quotes its text after the colon
        const name = accessibleNameIn('- paragraph: "A framework for building the world"');

        // Then - the window falls back to the text rather than printing it as a name
        expect(name).toBeUndefined();
    });

    test('says nothing for an unnamed node, and for an empty snapshot', () => {
        // Given - a landmark with no name at all, and a node that is no longer there
        // Then - neither invents one
        expect(accessibleNameIn('- banner')).toBeUndefined();
        expect(accessibleNameIn('')).toBeUndefined();
    });

    test('unescapes a quote the snapshot had to escape', () => {
        // Given - a name carrying a double quote
        const name = accessibleNameIn(String.raw`- button "Delete \"Draft\""`);

        // Then - the spelling handed back is the one to write
        expect(name).toBe('Delete "Draft"');
    });
});
