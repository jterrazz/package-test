import { describe, expect, test } from 'vitest';

import { button, dialog, field, link, listitem, option, row, status, table } from './roles.js';

describe('roles', () => {
    test('element vocabulary — builds a named target as plain data', () => {
        // Given - a link named by its accessible name
        const element = link('Articles');

        // Then - targets stay serializable; no locator leaks into the target
        expect(element).toStrictEqual({ kind: 'link', name: 'Articles' });
    });

    test('element vocabulary — names dialog, table and row by their role', () => {
        // Given - the roles the estate's UI specs were reaching for by hand
        const named = [dialog('Settings'), table('Posts'), row('A first post')];

        // Then - each is a target of its own role, named like any other
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

    test('option — names an option the way every other role target is named', () => {
        // Given - one of the channels a select offers
        const element = option('LinkedIn');

        // Then - it is a target of its role, carrying nothing else
        expect(element).toStrictEqual({ kind: 'option', name: 'LinkedIn' });
    });

    test('exact — stays absent when it was not asked for, so targets compare cleanly', () => {
        // Given - a target built without options
        const target = button('Subscribe');

        // Then - the default stays absent rather than false
        expect(target).toStrictEqual({ kind: 'button', name: 'Subscribe' });
    });

    test('exact — travels with the target when asked for, named or not', () => {
        // Given - a whole-name field and a partial-name table
        const targets = [field('Email', { exact: true }), table('Series', { exact: false })];

        // Then - each carries the flag it stated
        expect(targets).toStrictEqual([
            { exact: true, kind: 'field', name: 'Email' },
            { exact: false, kind: 'table', name: 'Series' },
        ]);
    });
});
