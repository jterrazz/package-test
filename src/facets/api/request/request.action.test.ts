import { describe, expect, test } from 'vitest';

import { defineCapability } from '../../../kernel/chain/capability.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import { headers } from '../../../kernel/context/headers.capability.js';
import type { ServerPort, ServerRequestOptions } from '../server/server.port.js';
import { get } from './request.action.js';

const armed = defineCapability({
    arm: (_slice: null, drivers: { log: string[] }) => {
        drivers.log.push('armed');
        return {};
    },
    initial: null,
    name: 'armed',
    phase: 10,
    reduce: () => null,
    row: { group: 'Setup', name: '.armed()', probe: '.armed(' },
});

type Chain = {
    armed: () => Chain;
    get: (path: string, options?: { params?: Record<string, number | string> }) => Promise<unknown>;
    headers: (headers: Record<string, string>) => Chain;
};

function chainOver(log: string[]): Chain {
    const server: ServerPort = {
        request: async (method, path, body, options?: ServerRequestOptions) => {
            log.push(JSON.stringify({ body, method, options, path }));
            return await Promise.resolve({ body: null, headers: {}, status: 204 });
        },
    };
    return defineFacet<Chain>()({
        actions: [get],
        capabilities: [armed, headers],
        drivers: () => ({ log, server }),
        locate: () => '/specs/users',
        options: {},
    }).open({});
}

describe('request', () => {
    test('request.action — .get() — the request a chain sends — sends the filled path, the template route coverage reads, and the chain’s headers', async () => {
        // Given - a chain with a header, sending a route template and its parameter
        const log: string[] = [];
        await chainOver(log)
            .headers({ 'x-chain': 'own' })
            .armed()
            .get('/users/:id', { params: { id: 'ada lovelace' } });

        // Then - the setup was armed, then the app was sent the encoded path, and told the route it was written as
        expect(log).toStrictEqual([
            'armed',
            JSON.stringify({
                method: 'GET',
                options: { headers: { 'x-chain': 'own' }, template: '/users/:id' },
                path: '/users/ada%20lovelace',
            }),
        ]);
    });

    test('request.action — .get() — the request a chain sends — refuses a template handed no values before any setup of the chain is armed', async () => {
        // Given - a chain with a setup, sending a template with no params
        const log: string[] = [];
        const sent = chainOver(log).armed().get('/users/:id');

        // Then - refused, and nothing was armed nor sent
        await expect(sent).rejects.toThrow('names :id and is handed no params');
        expect(log).toStrictEqual([]);
    });
});
