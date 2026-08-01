import { describe, expect, test } from 'vitest';

import { anthropic } from '../../integrations/anthropic/anthropic.js';
import { type Contract, defineContract, defineContracts } from './contract.js';
import { http } from './http.js';

/** A contract for one route, tagged by response body so order is observable. */
function route(method: 'GET' | 'POST', url: RegExp | string, tag: string): Contract {
    return {
        request: method === 'GET' ? http.get(url) : http.post(url),
        response: http.json({ tag }),
    };
}

function tagsOf(contracts: readonly Contract[]): string[] {
    return contracts.map((contract) => {
        const response = contract.response as { body: { tag: string } };
        return response.body.tag;
    });
}

describe('contracts — defineContract', () => {
    test('accepts a dynamic response function of the request', () => {
        // Given - a contract whose response derives from the observed request
        const contract = defineContract({
            request: anthropic.messages(),
            response: (request) => {
                const body = request.body as { q: string };
                return anthropic.reply(`echo:${body.q}`);
            },
        });

        // Then - the response is stored as the function, evaluable per request,
        // And the produced reply echoes the observed request into the envelope
        expect(typeof contract.response).toBe('function');
        const produced =
            typeof contract.response === 'function'
                ? contract.response({
                      body: { q: 'hi' },
                      headers: {},
                      method: 'POST',
                      url: 'https://x.test/',
                  })
                : contract.response;
        const content = (produced.body as { content: { text: string }[] }).content;
        expect(content[0].text).toBe('echo:hi');
    });

    test('builder .intercept() accepts a contract as a single argument', async () => {
        // Given - a facet with no adapters and a declared contract
        const { createApiFacet } = await import('../specification/shared/builder.js');
        const api = createApiFacet({});

        const contract = defineContract({
            request: anthropic.messages(),
            response: anthropic.reply('hello'),
        });

        // Then - the single-argument contract overload chains without throwing;
        // Further chaining returns the same builder
        const builder = api.intercept(contract);
        expect(builder.intercept(contract)).toBe(builder);
    });
});

describe('contracts — defineContracts composition', () => {
    test('flattens contracts, lists, and other composites, order preserved', () => {
        // Given - a composite built from a contract, a list, and a composite
        const base = defineContracts(route('GET', '/a', 'a'));
        const composite = defineContracts(
            base,
            [route('GET', '/b', 'b'), route('GET', '/c', 'c')],
            route('GET', '/d', 'd'),
        );

        // Then - one flat ordered list, contracts all the way down
        expect(tagsOf(composite.contracts)).toEqual(['a', 'b', 'c', 'd']);
    });

    test('.with() replaces same-route contracts and prepends the overrides', () => {
        // Given - a two-route world and an override on one of them
        const base = defineContracts(route('GET', '/events', 'events'), route('GET', '/a', 'a'));

        // When - a scenario overrides the /events route
        const scenario = base.with(route('GET', '/events', 'events-empty'));

        // Then - the base entry is gone and the override leads the list
        expect(tagsOf(scenario.contracts)).toEqual(['events-empty', 'a']);
    });

    test('.with() keeps a generic route but the more specific override wins first-match', () => {
        // Given - a generic token route, overridden by a concrete path
        const base = defineContracts(route('GET', '/articles/{{uuid}}', 'generic'));

        // When - the scenario states one article behaves differently
        const scenario = base.with(route('GET', '/articles/a-1', 'gone'));

        // Then - both survive; the specific one is selected first
        expect(tagsOf(scenario.contracts)).toEqual(['gone', 'generic']);
    });

    test('same-route is method + declared url source, RegExp compared by source', () => {
        // Given - one route declared as a RegExp, plus a same-url POST
        const base = defineContracts(
            route('GET', /articles\/\d+/, 'get-re'),
            route('POST', /articles\/\d+/, 'post-re'),
        );

        // When - an override reuses an equal (but not identical) RegExp on GET
        const scenario = base.with(route('GET', /articles\/\d+/, 'override'));

        // Then - only the GET was replaced; the POST on the same url stays
        expect(tagsOf(scenario.contracts)).toEqual(['override', 'post-re']);
    });

    test('.with() is immutable — the base composite is untouched', () => {
        // Given - a base composite
        const base = defineContracts(route('GET', '/events', 'events'));

        // When - a scenario derives from it
        const scenario = base.with(route('GET', '/events', 'other'));

        // Then - the base still declares its own world, and composites nest
        expect(tagsOf(base.contracts)).toEqual(['events']);
        const nested = scenario.with(route('GET', '/x', 'x'));
        expect(tagsOf(nested.contracts)).toEqual(['x', 'other']);
    });
});
