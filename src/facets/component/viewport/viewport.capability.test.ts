import { describe, expect, test } from 'vitest';

import { defineAction } from '../../../kernel/chain/action.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import { viewport } from './viewport.capability.js';
import type { ViewportMethod } from './viewport.capability.js';
import type { ViewportPort } from './viewport.port.js';

type Chain = { settle: () => Promise<null>; viewport: ViewportMethod<Chain> };

const settle = defineAction({
    accessors: [],
    name: 'settle',
    perform: async () => await Promise.resolve(null),
    row: { group: 'Terminal action', name: '.settle()', probe: '.settle(' },
});

function chainOver(): { chain: Chain; resized: { height: number; width: number }[] } {
    const resized: { height: number; width: number }[] = [];
    const page: ViewportPort = {
        size: async (size) => {
            resized.push(size);
            return await Promise.resolve({});
        },
    };
    const facet = defineFacet<Chain>()({
        actions: [settle],
        capabilities: [viewport],
        drivers: () => ({ viewport: page }),
        locate: () => '/specs',
        options: {},
    });
    return { chain: facet.open({}), resized };
}

describe('viewport', () => {
    test('.viewport() — the page size one render gets — resizes the page to the size stated last, once', async () => {
        // Given - a chain that narrowed the page, then stated another size
        const { chain, resized } = chainOver();
        await chain
            .viewport({ height: 640, width: 400 })
            .viewport({ height: 800, width: 360 })
            .settle();

        // Then - the later size replaced the earlier one: one resize, to it
        expect(resized).toStrictEqual([{ height: 800, width: 360 }]);
    });

    test('.viewport() — the page size one render gets — leaves the page alone when the chain states no size', async () => {
        // Given - a chain with no viewport of its own
        const { chain, resized } = chainOver();
        await chain.settle();

        // Then - the project's size stands, and nothing asked to restore it
        expect(resized).toStrictEqual([]);
    });
});
