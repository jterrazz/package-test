import { afterAll } from 'vitest';

import { redis, specification } from '../../src/index.js';

/**
 * The cache runner: the redis seam met against a real container. The subject
 * is the handle the framework hands a consumer, so the facet starts the
 * service and every chain calls the adapter with the live connection string.
 * Two caches, alike but for their names, are what a service's own container
 * is proven by.
 */
export const { cleanup, integration } = await specification.integration({
    root: '../shared/fixtures/specimen-api',
    services: { cache: redis(), queue: redis() },
});

afterAll(cleanup);
