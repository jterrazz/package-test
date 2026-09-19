import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { quoteOrder } from '../../_fixtures/orders/orders.js';
import { integration } from '../pure.specification.js';

const PRICING = 'https://pricing.spec.test';

describe('integration — the world the module reaches', () => {
    test('answers the module with what the contract declared', async () => {
        // Given - the one call this module makes, declared for the chain
        const result = await integration
            .intercept(http.get(`${PRICING}/quotes/ORD-1`), http.json({ total: 42 }))
            .call(async () => await quoteOrder(PRICING, 'ORD-1'));

        // Then - the module answered with what the provider replied
        expect(result.value).toMatch('quoted.json');
    });

    test('reads the refusal of the module when the provider says no', async () => {
        // Given - a provider that refuses
        const result = await integration
            .intercept(http.get(`${PRICING}/quotes/ORD-2`), http.error(503))
            .call(async () => await quoteOrder(PRICING, 'ORD-2'));

        // Then - the module's message is the reading, not the status
        expect(result.error).toMatch('unavailable.txt');
    });

    test('fails the chain on a call no contract accepted', async () => {
        // Given - a contract for one reference, and a module asked for another
        const chain = integration
            .intercept(http.get(`${PRICING}/quotes/ORD-1`), http.json({ total: 42 }))
            .call(async () => await quoteOrder(PRICING, 'ORD-9'));

        // Then - the undeclared call fails the CHAIN, not the module: a
        // Refusal the module chose is `result.error`, a call nobody declared
        // Is the spec's own mistake (D7)
        await expect(chain).rejects.toThrow('ORD-9');
    });
});
