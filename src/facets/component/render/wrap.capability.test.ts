import { describe, expect, test } from 'vitest';

import { defineAction } from '../../../kernel/chain/action.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import { wrap } from './wrap.capability.js';
import type { WrapMethod } from './wrap.capability.js';

type Chain = { dress: (ui: string) => Promise<unknown>; wrap: WrapMethod<Chain> };

const dress = defineAction({
    accessors: [],
    name: 'dress',
    perform: async ([ui]: [ui: string], read) => {
        const wrapper = read(wrap);
        return await Promise.resolve(wrapper === null ? ui : wrapper(ui));
    },
    row: { group: 'Terminal action', name: '.dress()', probe: '.dress(' },
});

function chain(): Chain {
    return defineFacet<Chain>()({
        actions: [dress],
        capabilities: [wrap],
        engines: () => ({}),
        locate: () => '/specs',
        options: {},
    }).open({});
}

describe('wrap', () => {
    test('.wrap() — the frame a chain renders in — dresses the subject in the wrapper stated last, never in both', async () => {
        // Given - a router stub, then a strict frame stated after it
        const dressed = await chain()
            .wrap((ui) => ['router', ui])
            .wrap((ui) => ['strict', ui])
            .dress('Nav');

        // Then - the later wrapper replaced the earlier one: they do not nest
        expect(dressed).toStrictEqual(['strict', 'Nav']);
    });
});
