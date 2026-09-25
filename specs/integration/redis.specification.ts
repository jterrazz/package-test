import { afterAll } from 'vitest';

import { redis, specification } from '../../src/index.js';

/** Two caches alike but for their names prove one container holding an index per (worker, service) pair. */
export const { cleanup, integration } = await specification.integration({
    root: '../shared/fixtures/specimen-api',
    services: { cache: redis(), queue: redis() },
});

afterAll(cleanup);
