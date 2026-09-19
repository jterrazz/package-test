import { afterAll } from 'vitest';

import { postgres, specification } from '../../src/index.js';

/**
 * The integration runner: a module specified against a REAL database. The
 * subject is `specs/_fixtures/orders/orders.ts`, which knows nothing about
 * the test — it is handed a connection string and called.
 */
export const { cleanup, integration } = await specification.integration({
    root: '../_fixtures/app',
    services: { db: postgres() },
});

afterAll(cleanup);
