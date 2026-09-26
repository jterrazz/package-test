import { describe, expect, test } from 'vitest';

import { dialog, link, listitem, option, row, status, table } from './roles.js';

describe('roles', () => {
    test('element vocabulary — builds a named descriptor as plain data', () => {
        // Given - a link named by its accessible name
        const element = link('Articles');

        // Then - descriptors stay serializable; no locator leaks into the descriptor
        expect(element).toStrictEqual({ kind: 'link', name: 'Articles' });
    });

    test('element vocabulary — names dialog, table and row by their role', () => {
        // Given - the roles the estate's UI specs were reaching for by hand
        const named = [dialog('Settings'), table('Posts'), row('A first post')];

        // Then - each is a descriptor of its own role, named like any other
        expect(named).toStrictEqual([
            { kind: 'dialog', name: 'Settings' },
            { kind: 'table', name: 'Posts' },
            { kind: 'row', name: 'A first post' },
        ]);
    });

    test('element vocabulary — lets the roles that usually carry no name stay anonymous', () => {
        // Given - the live region of a page, and the item of a list
        // Then - a name is optional, exactly as it is on a landmark
        expect([status(), listitem('Part 2')]).toStrictEqual([
            { kind: 'status' },
            { kind: 'listitem', name: 'Part 2' },
        ]);
    });

    test('option — names an option the way every other role descriptor is named', () => {
        // Given - one of the channels a select offers
        const element = option('LinkedIn');

        // Then - it is a descriptor of its role, carrying nothing else
        expect(element).toStrictEqual({ kind: 'option', name: 'LinkedIn' });
    });
});
