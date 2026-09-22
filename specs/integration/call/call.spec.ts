import { describe, expect, test } from 'vitest';

import { file } from '../../../src/index.js';
import { listOrders, placeOrder } from '../../fixtures/orders/orders.js';
import { integration } from '../integration.specification.js';

describe('integration — a module against the real database', () => {
    test('reads what the seed put there', async () => {
        // Given - two orders in the real database, and the module asked for them
        const result = await integration
            .seed(file('./seeds/two-orders.sql'))
            .call(async ({ db }) => await listOrders(db.connectionString));

        // Then - the module answered with both, and refused nothing
        expect(result.value).toMatch(file('./expected/two-orders.json'));
        expect(result.error.text).toBe('');
    });

    test('writes what the module was told to write', async () => {
        // Given - the module asked to record one order
        const result = await integration
            .seed(file('./seeds/two-orders.sql'))
            .call(
                async ({ db }) =>
                    await placeOrder(db.connectionString, { reference: 'ORD-3', total: 7 }),
            );

        // Then - it said so, and the row is in the database it wrote to
        expect(result.value).toMatch(file('./expected/recorded.txt'));
        await expect(result.table('orders')).toMatchRows({
            columns: ['reference'],
            rows: [['ORD-1'], ['ORD-2'], ['ORD-3']],
        });
    });

    test('reads a refusal as a refusal, with no try in the spec', async () => {
        // Given - the module asked to record an order that is not one
        const result = await integration
            .seed(file('./seeds/two-orders.sql'))
            .call(
                async ({ db }) =>
                    await placeOrder(db.connectionString, { reference: 'ORD-4', total: 0 }),
            );

        // Then - what it threw is the reading, and nothing was written
        expect(result.error).toMatch(file('./expected/refused.txt'));
        await expect(result.table('orders')).toMatchRows({
            columns: ['reference'],
            rows: [['ORD-1'], ['ORD-2']],
        });
    });

    test('starts every chain from the same database state', async () => {
        // Given - a chain that wrote, then a chain that only reads
        await integration
            .seed(file('./seeds/two-orders.sql'))
            .call(
                async ({ db }) =>
                    await placeOrder(db.connectionString, { reference: 'ORD-9', total: 3 }),
            );
        const result = await integration
            .seed(file('./seeds/two-orders.sql'))
            .call(async ({ db }) => await listOrders(db.connectionString));

        // Then - the second chain never saw the first one's row
        expect(result.value).toMatch(file('./expected/two-orders.json'));
    });
});
