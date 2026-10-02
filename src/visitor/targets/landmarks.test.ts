import { describe, expect, test } from 'vitest';

import { main, navigation, region, scopeChain, within } from './landmarks.js';
import { button, link, testId } from './roles.js';

describe('landmarks', () => {
    test('main — builds an anonymous landmark without a name', () => {
        // Given - the primary content region
        const target = main();

        // Then - it designates the region itself, not a named one
        expect(target).toStrictEqual({ kind: 'main' });
    });

    test('navigation — builds a named landmark for pages carrying several of a region', () => {
        // Given - a page with more than one nav
        const target = navigation('Breadcrumb');

        // Then - the accessible name distinguishes them
        expect(target).toStrictEqual({ kind: 'navigation', name: 'Breadcrumb' });
    });

    test('within — attaches the scope to the target', () => {
        // Given - a link designated inside the nav
        const target = within(navigation(), link('Articles'));

        // Then - the scope rides along on the target
        expect(target).toStrictEqual({
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

    test('within — accepts any target as a scope, including the escape hatch', () => {
        // Given - a container with no landmark role to stand on
        const target = within(testId('row-3'), button('Delete'));

        // Then - the escape hatch is still scopable
        expect(target.scope).toStrictEqual({ kind: 'testId', name: 'row-3' });
    });

    test('within — leaves the original target untouched', () => {
        // Given - a target reused across two scopes
        const target = link('Articles');

        // When - it is scoped
        within(navigation(), target);

        // Then - the source target is not mutated
        expect(target.scope).toBeUndefined();
    });

    test('region — carries exact when asked for', () => {
        // Given - a named region opting out of the whole-name match
        const target = region('Series', { exact: false });

        // Then - the stated flag travels with the target
        expect(target).toStrictEqual({ exact: false, kind: 'region', name: 'Series' });
    });

    test('scopeChain — unrolls a nested scope from the outermost container to the target', () => {
        // Given - a link scoped to a region, itself scoped to main
        const target = within(main(), within(region('Series'), link('Part 2')));

        // Then - each level stands alone, outermost first
        expect(scopeChain(target).map(({ kind, name }) => ({ kind, name }))).toStrictEqual([
            { kind: 'main', name: undefined },
            { kind: 'region', name: 'Series' },
            { kind: 'link', name: 'Part 2' },
        ]);
    });

    test('scopeChain — keeps every level of a scope nested three deep', () => {
        // Given - a link inside a nav, inside a named region, inside main
        const inNavigation = within(navigation(), link('Part 2'));
        const target = within(main(), within(region('Series'), inNavigation));

        // Then - no level is lost, outermost first
        expect(scopeChain(target).map(({ kind }) => kind)).toStrictEqual([
            'main',
            'region',
            'navigation',
            'link',
        ]);
    });

    test('scopeChain — answers an unscoped target with itself alone', () => {
        // Given - a bare link
        const target = link('Articles');

        // Then - the chain is that one level
        expect(scopeChain(target)).toStrictEqual([target]);
    });
});
