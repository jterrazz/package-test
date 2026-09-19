import { afterAll } from 'vitest';

import { redis, specification } from '../../src/index.js';

/**
 * The cache runner: the redis seam met against a real container. The subject
 * is the handle the framework hands a consumer, so the facet starts the
 * service and every chain calls the adapter with the live connection string.
 */
export const { cleanup, integration } = await specification.integration({
    root: '../_fixtures/app',
    services: { cache: redis() },
});

afterAll(cleanup);
