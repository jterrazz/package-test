import { describe, expect, test } from 'vitest';

import { button, dialog, field, link, listitem, option, row, status, table } from './roles.js';

describe('roles', () => {
    test('link — builds a named target as plain data', () => {
        // Given - a link named by its accessible name
        const target = link('Articles');

        // Then - targets stay serializable; no locator leaks into the target
        expect(target).toStrictEqual({ kind: 'link', name: 'Articles' });
    });

    test('dialog / table / row — name a target by its role', () => {
        // Given - the roles the estate's UI specs were reaching for by hand
        const named = [dialog('Settings'), table('Posts'), row('A first post')];

        // Then - each is a target of its own role, named like any other
        expect(named).toStrictEqual([
            { kind: 'dialog', name: 'Settings' },
            { kind: 'table', name: 'Posts' },
            { kind: 'row', name: 'A first post' },
        ]);
    });

    test('status / listitem — leave the name optional on the roles that usually carry none', () => {
        // Given - the live region of a page, and the item of a list
        // Then - a name is optional, exactly as it is on a landmark
        expect([status(), listitem('Part 2')]).toStrictEqual([
            { kind: 'status' },
            { kind: 'listitem', name: 'Part 2' },
        ]);
    });

    test('option — names an option the way every other role target is named', () => {
        // Given - one of the channels a select offers
        const target = option('LinkedIn');

        // Then - it is a target of its role, carrying nothing else
        expect(target).toStrictEqual({ kind: 'option', name: 'LinkedIn' });
    });

    test('button — leaves exact absent when it was not asked for, so targets compare cleanly', () => {
        // Given - a target built without options
        const target = button('Subscribe');

        // Then - the default stays absent rather than false
        expect(target).toStrictEqual({ kind: 'button', name: 'Subscribe' });
    });

    test('field / table — carry exact when asked for, named or optionally named', () => {
        // Given - a whole-name field and a partial-name table
        const targets = [field('Email', { exact: true }), table('Series', { exact: false })];

        // Then - each carries the flag it stated
        expect(targets).toStrictEqual([
            { exact: true, kind: 'field', name: 'Email' },
            { exact: false, kind: 'table', name: 'Series' },
        ]);
    });
});
