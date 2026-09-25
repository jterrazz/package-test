import { describe, expect, test } from 'vitest';

import { defineFacet } from '../../facets/define-facet.js';
import { defineAction } from '../../model/chain/action.js';
import { defineContracts } from '../../stubs/contract.js';
import type { Contract } from '../../stubs/contract.js';
import { http } from '../../stubs/http/http.js';
import { intercept } from './intercept.capability.js';
import type { InterceptMethod } from './intercept.capability.js';
import type { InterceptPort } from './intercept.port.js';

/** A chain composed of `.intercept()` alone, ending on an action that does nothing. */
type Chain = { intercept: InterceptMethod<Chain>; settle: () => Promise<null> };

const settle = defineAction({
    accessors: [],
    name: 'settle',
    perform: async () => await Promise.resolve(null),
    row: { group: 'Terminal action', name: '.settle()', probe: '.settle(' },
});

/** A chain over an engine that records what it was armed with — or refuses to serve anything. */
function chainOver(refusal?: Error): { armed: (readonly Contract[])[]; chain: Chain } {
    const armed: (readonly Contract[])[] = [];
    const network: InterceptPort = {
        accepts: () => {
            if (refusal !== undefined) {
                throw refusal;
            }
        },
        arm: async (contracts) => {
            armed.push(contracts);
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

/** The body each armed contract replies, in queue order. */
function replies(armed: (readonly Contract[])[]): unknown[] {
    return armed
        .flat()
        .map((contract) =>
            typeof contract.response === 'function' ? null : contract.response.body,
        );
}

describe('.intercept() — the calls a chain declares', () => {
    test('arms a list, then a later call, in the order they were written', async () => {
        // Given - two contracts on one route as one list, and a third call after them
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

    test('flattens a composite, its scenario override leading the queue', async () => {
        // Given - a composite and a scenario derived from it
        const { armed, chain } = chainOver();
        const request = http.get('https://x.test/');
        const base = defineContracts(
            { request, response: http.json({ n: 1 }) },
            { request: http.get('https://y.test/'), response: http.json({ n: 2 }) },
        );

        // When - the chain declares the scenario
        await chain.intercept(base.with({ request, response: http.json({ n: 9 }) })).settle();

        // Then - the override replaced its route and leads the queue
        expect(replies(armed)).toStrictEqual([{ n: 9 }, { n: 2 }]);
    });

    test('is refused when stated, before anything is parsed, by an engine that serves nothing', () => {
        // Given - an engine that cannot serve a contract at all
        const { chain } = chainOver(new Error('this runner has no declared backend'));

        // Then - the engine's refusal is the one raised, even for a call that would itself be refused
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a bare request half is what only an untyped caller can hand over: the overloads refuse it at every typed site
        expect(() => chain.intercept(http.get('https://x.test/') as never)).toThrow(
            'this runner has no declared backend',
        );
    });
});
