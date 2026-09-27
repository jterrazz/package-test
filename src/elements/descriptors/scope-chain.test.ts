import { describe, expect, test } from 'vitest';

import { main, region, within } from './landmarks.js';
import { link } from './roles.js';
import { scopeChain } from './scope-chain.js';

describe('scopeChain', () => {
    test('scopeChain — unrolls a nested scope from the outermost container to the target', () => {
        // Given - a link scoped to a region, itself scoped to main
        const element = within(main(), within(region('Series'), link('Part 2')));

        // Then - each level stands alone, outermost first
        expect(scopeChain(element).map(({ kind, name }) => ({ kind, name }))).toStrictEqual([
            { kind: 'main', name: undefined },
            { kind: 'region', name: 'Series' },
            { kind: 'link', name: 'Part 2' },
        ]);
    });

    test('scopeChain — answers an unscoped descriptor with itself alone', () => {
        // Given - a bare link
        const element = link('Articles');

        // Then - the chain is that one level
        expect(scopeChain(element)).toStrictEqual([element]);
    });
});
