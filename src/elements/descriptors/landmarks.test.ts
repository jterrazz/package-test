import { describe, expect, test } from 'vitest';

import { main, navigation, region, within } from './landmarks.js';
import { button, link, testId } from './roles.js';

describe('landmarks', () => {
    test('landmark — builds an anonymous landmark without a name', () => {
        // Given - the primary content region
        const element = main();

        // Then - it designates the region itself, not a named one
        expect(element).toStrictEqual({ kind: 'main' });
    });

    test('landmark — builds a named landmark for pages carrying several of a region', () => {
        // Given - a page with more than one nav
        const element = navigation('Breadcrumb');

        // Then - the accessible name distinguishes them
        expect(element).toStrictEqual({ kind: 'navigation', name: 'Breadcrumb' });
    });

    test('within — attaches the scope to the target', () => {
        // Given - a link designated inside the nav
        const element = within(navigation(), link('Articles'));

        // Then - the scope rides along on the descriptor
        expect(element).toStrictEqual({
            kind: 'link',
            name: 'Articles',
            scope: { kind: 'navigation' },
        });
    });

    test('within — nests scopes outside-in rather than replacing them', () => {
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

    test('within — accepts any descriptor as a scope, including the escape hatch', () => {
        // Given - a container with no landmark role to stand on
        const element = within(testId('row-3'), button('Delete'));

        // Then - the escape hatch is still scopable
        expect(element.scope).toStrictEqual({ kind: 'testId', name: 'row-3' });
    });

    test('within — leaves the original target untouched', () => {
        // Given - a descriptor reused across two scopes
        const target = link('Articles');

        // When - it is scoped
        within(navigation(), target);

        // Then - the source descriptor is not mutated
        expect(target.scope).toBeUndefined();
    });
});
