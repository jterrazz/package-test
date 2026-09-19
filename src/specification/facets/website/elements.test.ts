import { describe, expect, test } from 'vitest';

import {
    button,
    dialog,
    field,
    focused,
    link,
    listitem,
    main,
    navigation,
    region,
    row,
    status,
    table,
    testId,
    within,
} from './elements.js';

describe('element vocabulary', () => {
    test('builds a named descriptor as plain data', () => {
        // Given - a link named by its accessible name
        const element = link('Articles');

        // Then - descriptors stay serializable; no locator leaks into core
        expect(element).toStrictEqual({ kind: 'link', name: 'Articles' });
    });

    test('omits exact when it was not asked for', () => {
        // Given - a descriptor built without options
        const element = button('Subscribe');

        // Then - the default stays absent rather than false, so refs compare cleanly
        expect(element).toStrictEqual({ kind: 'button', name: 'Subscribe' });
    });

    test('carries exact when asked for', () => {
        // Given - a descriptor asking for a whole-name match
        const element = field('Email', { exact: true });

        // Then - the flag travels with the descriptor
        expect(element).toStrictEqual({ exact: true, kind: 'field', name: 'Email' });
    });

    test('builds an anonymous landmark without a name', () => {
        // Given - the primary content region
        const element = main();

        // Then - it designates the region itself, not a named one
        expect(element).toStrictEqual({ kind: 'main' });
    });

    test('builds a named landmark for pages carrying several of a region', () => {
        // Given - a page with more than one nav
        const element = navigation('Breadcrumb');

        // Then - the accessible name distinguishes them
        expect(element).toStrictEqual({ kind: 'navigation', name: 'Breadcrumb' });
    });

    test('names the five roles a visitor reads rather than the container it sits in', () => {
        // Given - the roles the estate's UI specs were reaching for by hand
        const named = [dialog('Settings'), table('Posts'), row('A first post')];

        // Then - each is a descriptor of its own role, named like any other
        expect(named).toStrictEqual([
            { kind: 'dialog', name: 'Settings' },
            { kind: 'table', name: 'Posts' },
            { kind: 'row', name: 'A first post' },
        ]);
    });

    test('lets the roles that usually carry no name stay anonymous', () => {
        // Given - the live region of a page, and the item of a list
        // Then - a name is optional, exactly as it is on a landmark
        expect([status(), listitem('Part 2')]).toStrictEqual([
            { kind: 'status' },
            { kind: 'listitem', name: 'Part 2' },
        ]);
    });
});

describe('focused', () => {
    test('modifies a descriptor rather than replacing it', () => {
        // Given - the button a dialog should hand the keyboard back to
        const element = focused(button('Open'));

        // Then - the descriptor is the same one, asked about its focus
        expect(element).toStrictEqual({ focused: true, kind: 'button', name: 'Open' });
    });

    test('survives scoping, so the keyboard can be asserted inside a landmark', () => {
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
});

describe('within', () => {
    test('attaches the scope to the target', () => {
        // Given - a link designated inside the nav
        const element = within(navigation(), link('Articles'));

        // Then - the scope rides along on the descriptor
        expect(element).toStrictEqual({
            kind: 'link',
            name: 'Articles',
            scope: { kind: 'navigation' },
        });
    });

    test('nests scopes outside-in rather than replacing them', () => {
        // Given - a target already scoped to a region
        const inner = within(region('Series'), link('Part 2'));

        // When - that whole thing is scoped again
        const nested = within(main(), inner);

        // Then - the region keeps the target and gains main as its own scope
        expect(nested).toStrictEqual({
            kind: 'link',
            name: 'Part 2',
            scope: { kind: 'region', name: 'Series', scope: { kind: 'main' } },
        });
    });

    test('accepts any descriptor as a scope, including the escape hatch', () => {
        // Given - a container with no landmark role to stand on
        const element = within(testId('row-3'), button('Delete'));

        // Then - the escape hatch is still scopable
        expect(element.scope).toStrictEqual({ kind: 'testId', name: 'row-3' });
    });

    test('leaves the original target untouched', () => {
        // Given - a descriptor reused across two scopes
        const target = link('Articles');

        // When - it is scoped
        within(navigation(), target);

        // Then - the source descriptor is not mutated
        expect(target.scope).toBeUndefined();
    });
});
