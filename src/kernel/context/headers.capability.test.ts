import { describe, expect, test } from 'vitest';

import { defineAction } from '../chain/action.js';
import { defineFacet } from '../chain/define-facet.js';
import { headers } from './headers.capability.js';
import { sharing } from './with.capability.js';

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

function chain(): Chain {
    return defineFacet<Chain>()({
        actions: [send],
        capabilities: [headers, sharing],
        drivers: () => ({}),
        locate: () => '/specs',
        options: {},
    }).open({});
}

describe('headers', () => {
    test('.headers() — what the chain’s exchange carries — merges the view’s headers and every call, the value stated last winning its name', async () => {
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
