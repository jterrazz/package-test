import { describe, expect, test } from 'vitest';

import { defineContracts } from '../../stubs/contract.js';
import type { Contract } from '../../stubs/contract.js';
import { http } from '../../stubs/http/http.js';
import { SpecificationBuilder } from './builder.js';

/** The contracts a chain accumulated, tagged by their response body number. */
function declaredNumbers(builder: SpecificationBuilder): number[] {
    const internals = builder as unknown as {
        contracts: { response: { body: { n: number } } }[];
    };
    return internals.contracts.map((contract) => contract.response.body.n);
}

describe('builder — intercept input forms', () => {
    test('a list of contracts registers in declaration order', () => {
        // Given - two contracts on one route, distinguishable by response body
        const builder = new SpecificationBuilder({}, import.meta.dirname);
        const request = http.get('https://x.test/');
        const first: Contract = { request, response: http.json({ n: 1 }) };
        const second: Contract = { request, response: http.json({ n: 2 }) };

        // When - registered as a single array call
        builder.intercept([first, second]);

        // Then - both are queued, in array order (identical to two calls)
        expect(declaredNumbers(builder)).toStrictEqual([1, 2]);
    });

    test('a composite is flattened, and .with() lands its override first', () => {
        // Given - a composite and a scenario derived from it
        const builder = new SpecificationBuilder({}, import.meta.dirname);
        const request = http.get('https://x.test/');
        const base = defineContracts(
            { request, response: http.json({ n: 1 }) },
            { request: http.get('https://y.test/'), response: http.json({ n: 2 }) },
        );

        // When - the chain declares the scenario
        builder.intercept(base.with({ request, response: http.json({ n: 9 }) }));

        // Then - the override replaced its route and leads the queue
        expect(declaredNumbers(builder)).toStrictEqual([9, 2]);
    });

    test('a bare request half without its response is refused', () => {
        // Given - a chain handed only the request half
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - the error names both accepted forms
        expect(() => builder.intercept(http.get('https://x.test/') as never)).toThrow(
            '.intercept(): a bare request needs its response',
        );
    });
});

describe('builder — the request a chain declares', () => {
    test('.intercept() takes an inline pair and chains', () => {
        // Given - a plain builder
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - registering an inline intercept chains normally
        expect(() => builder.intercept(http.get('https://x.test/'), http.json({}))).not.toThrow();
    });
});

// ── Stub-backend facets ──

describe('builder — contracts on the stub facets', () => {
    test('a mobile chain without a backend option names its own constructor', () => {
        // Given - a mobile-shaped config (a device accessor, no backend)
        const builder = new SpecificationBuilder(
            {
                device: async () => {
                    throw new Error('unused');
                },
            },
            import.meta.dirname,
        );

        // Then - the fix names specification.mobile
        expect(() =>
            builder.intercept({ request: http.get('/events'), response: http.empty() }),
        ).toThrow('specification.mobile({ …, backend');
    });
});

describe('builder — what a file shares, with()', () => {
    test('a context states only what it names: no clock, nothing set', () => {
        // Given - a chain handed an empty context
        const builder = new SpecificationBuilder({}, '/tmp').with({});

        // Then - it pins nothing
        const internals = builder as unknown as { pinnedClock: null | string };
        expect(internals.pinnedClock).toBeNull();
    });
});

describe('builder — the calendar a chain pins', () => {
    test('.clock() takes the instant and travels with the chain', () => {
        // Given - a plain builder
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - the instant is accepted
        expect(() => builder.clock('2026-03-04T09:30:00Z')).not.toThrow();
    });
});
