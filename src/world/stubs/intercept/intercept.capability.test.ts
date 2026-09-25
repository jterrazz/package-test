import { describe, expect, test } from 'vitest';

import { defineAction } from '../../../kernel/chain/action.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import { http } from '../http/http.js';
import { defineStubs } from '../stub.js';
import type { Stub } from '../stub.js';
import { intercept } from './intercept.capability.js';
import type { InterceptMethod } from './intercept.capability.js';
import type { InterceptPort } from './intercept.port.js';

type Chain = { intercept: InterceptMethod<Chain>; settle: () => Promise<null> };

const settle = defineAction({
    accessors: [],
    name: 'settle',
    perform: async () => await Promise.resolve(null),
    row: { group: 'Terminal action', name: '.settle()', probe: '.settle(' },
});

function chainOver(refusal?: Error): { armed: (readonly Stub[])[]; chain: Chain } {
    const armed: (readonly Stub[])[] = [];
    const network: InterceptPort = {
        accepts: () => {
            if (refusal !== undefined) {
                throw refusal;
            }
        },
        arm: async (stubs) => {
            armed.push(stubs);
            return await Promise.resolve({});
        },
    };
    const facet = defineFacet<Chain>()({
        actions: [settle],
        capabilities: [intercept],
        engines: () => ({ network }),
        locate: () => '/specs',
        options: {},
    });
    return { armed, chain: facet.open({}) };
}

function replies(armed: (readonly Stub[])[]): unknown[] {
    return armed
        .flat()
        .map((stub) => (typeof stub.response === 'function' ? null : stub.response.body));
}

describe('intercept', () => {
    test('.intercept() — the calls a chain declares — arms a list, then a later call, in the order they were written', async () => {
        // Given - two stubs on one route as one list, and a third call after them
        const { armed, chain } = chainOver();
        const request = http.get('https://x.test/');

        // When - the chain is armed
        await chain
            .intercept([
                { request, response: http.json({ n: 1 }) },
                { request, response: http.json({ n: 2 }) },
            ])
            .intercept(request, http.json({ n: 3 }))
            .settle();

        // Then - one arming, the queue in the order the chain stated it
        expect(replies(armed)).toStrictEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    });

    test('.intercept() — the calls a chain declares — flattens a composite, its scenario override leading the queue', async () => {
        // Given - a composite and a scenario derived from it
        const { armed, chain } = chainOver();
        const request = http.get('https://x.test/');
        const base = defineStubs(
            { request, response: http.json({ n: 1 }) },
            { request: http.get('https://y.test/'), response: http.json({ n: 2 }) },
        );

        // When - the chain declares the scenario
        await chain.intercept(base.with({ request, response: http.json({ n: 9 }) })).settle();

        // Then - the override replaced its route and leads the queue
        expect(replies(armed)).toStrictEqual([{ n: 9 }, { n: 2 }]);
    });

    test('.intercept() — the calls a chain declares — is refused when stated, before anything is parsed, by an engine that serves nothing', () => {
        // Given - an engine that cannot serve a stub at all
        const { chain } = chainOver(new Error('this runner has no declared backend'));

        // Then - the engine's refusal is the one raised, even for a call that would itself be refused
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a bare request half is what only an untyped caller can hand over: the overloads refuse it at every typed site
        expect(() => chain.intercept(http.get('https://x.test/') as never)).toThrow(
            'this runner has no declared backend',
        );
    });
});
