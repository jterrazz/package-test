import { describe, expect, test } from 'vitest';

import { defineFacet } from '../../facets/define-facet.js';
import { defineAction } from '../../model/chain/action.js';
import { sharing } from '../with/with.capability.js';
import { headers } from './headers.capability.js';

/** A chain of `.headers()` and `with()`, ending on an action that hands back the headers it would send. */
type Chain = {
    headers: (headers: Record<string, string>) => Chain;
    send: () => Promise<unknown>;
    with: (context: { headers?: Record<string, string> }) => Chain;
};

const send = defineAction({
    accessors: [],
    name: 'send',
    perform: async (_args: [], read) => await Promise.resolve(read(headers)),
    row: { group: 'Terminal action', name: '.send()', probe: '.send(' },
});

/** A chain nobody has set a header on yet. */
function chain(): Chain {
    return defineFacet<Chain>()({
        actions: [send],
        capabilities: [headers, sharing],
        engines: () => ({}),
        locate: () => '/specs',
        options: {},
    }).open({});
}

describe('.headers() — what the chain’s exchange carries', () => {
    test('merges the view’s headers and every call, the value stated last winning its name', async () => {
        // Given - a view sharing two headers, then two calls of the chain, each replacing one name the step before stated
        const sent = await chain()
            .with({ headers: { accept: 'text/html', 'x-tenant': 'file' } })
            .headers({ 'x-tenant': 'own', 'x-trace': 'first' })
            .headers({ 'x-trace': 'second' })
            .send();

        // Then - every name survives, each carrying the value stated last
        expect(sent).toStrictEqual({ accept: 'text/html', 'x-tenant': 'own', 'x-trace': 'second' });
    });
});
