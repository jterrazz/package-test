import { http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { quoteOrder } from '../__fixtures__/orders/orders.js';
import { integration } from '../pure.specification.js';

const PRICING = 'https://pricing.spec.test';

describe('declared', () => {
    test('answers the module with what the stub declared', async () => {
        // Given - the one call this module makes, declared for the chain
        const result = await integration
            .intercept(http.get(`${PRICING}/quotes/ORD-1`), http.json({ total: 42 }))
            .call(async () => await quoteOrder(PRICING, 'ORD-1'));

        // Then - the module answered with what the provider replied
        expect(result.value).toMatch(42);
    });

    test('reads the refusal of the module when the provider says no', async () => {
        // Given - a provider that refuses
        const result = await integration
            .intercept(http.get(`${PRICING}/quotes/ORD-2`), http.error(503))
            .call(async () => await quoteOrder(PRICING, 'ORD-2'));

        // Then - the module's message is the reading, not the status
        expect(result.error).toMatch(`the pricing service answered 503`);
    });

    test('fails the chain on a call no stub accepted', async () => {
        // Given - a stub for one reference, and a module asked for another
        const chain = integration
            .intercept(http.get(`${PRICING}/quotes/ORD-1`), http.json({ total: 42 }))
            .call(async () => await quoteOrder(PRICING, 'ORD-9'));

        // Then - the undeclared call fails the CHAIN, not the module: a refusal the module chose is `result.error`, a call nobody declared is the spec's own mistake (`network-strict-after-first-stub`)
        await expect(chain).rejects.toThrow('ORD-9');
    });
});
