import { redis, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/** Two caches alike but for their names prove one container holding an index per (worker, service) pair. */
export const { cleanup, integration } = await specification.integration({
    root: '../_shared/_fixtures/specimen-api',
    services: { cache: redis(), queue: redis() },
});

afterAll(cleanup);
