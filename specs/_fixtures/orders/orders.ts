import { Client } from 'pg';

/** One row of the orders table, as the module hands it out. */
export type Order = {
    id: number;
    placedAt: string;
    reference: string;
    total: number;
};

/**
 * The module the integration specs are written against: it reads and writes a
 * REAL database and reaches a REAL provider. Nothing here knows it is under
 * test — which is the point of the facet: the subject is the module, and what
 * it stands on is declared by the specification.
 */
export async function listOrders(databaseUrl: string): Promise<Order[]> {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        const { rows } = await client.query<{
            id: number;
            reference: string;
            total: string;
        }>('SELECT id, reference, total FROM "orders" ORDER BY id');
        return rows.map((row) => ({
            id: row.id,
            placedAt: new Date().toISOString(),
            reference: row.reference,
            total: Number(row.total),
        }));
    } finally {
        await client.end();
    }
}

/** Record an order, refusing the ones the rules say cannot exist. */
export async function placeOrder(
    databaseUrl: string,
    order: { reference: string; total: number },
): Promise<string> {
    if (order.total <= 0) {
        throw new Error(`an order of ${order.total} is not an order — reference ${order.reference}`);
    }
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        await client.query('INSERT INTO "orders" (reference, total) VALUES ($1, $2)', [
            order.reference,
            order.total,
        ]);
        return `recorded ${order.reference}`;
    } finally {
        await client.end();
    }
}

/** Ask the pricing service what a reference is worth today. */
export async function quoteOrder(pricingUrl: string, reference: string): Promise<number> {
    const response = await fetch(`${pricingUrl}/quotes/${reference}`);
    if (!response.ok) {
        throw new Error(`the pricing service answered ${response.status}`);
    }
    const body = (await response.json()) as { total: number };
    return body.total;
}
