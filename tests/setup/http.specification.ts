/**
 * Shared HTTP spec provider. Returns the appropriate runner based on
 * the SPEC_RUNNER env var: 'stack' for docker compose, default for in-process app.
 */
import { afterAll } from 'vitest';

import { app, postgres, redis, spec, type SpecRunner, stack } from '../../src/index.js';
import { createApp } from './fixtures/app/app.js';

async function createHttpSpec(): Promise<SpecRunner> {
    if (process.env.SPEC_RUNNER === 'stack') {
        return spec(stack('./fixtures/app'));
    }

    const db = postgres({ compose: 'db' });
    const analyticsDb = postgres({ compose: 'analytics-db' });
    const cache = redis({ compose: 'cache' });

    return spec(
        app((services) =>
            createApp({
                databaseUrl: services.db.connectionString,
                analyticsDatabaseUrl: services['analytics-db'].connectionString,
                redisUrl: services.cache.connectionString,
            }),
        ),
        { services: [db, analyticsDb, cache], root: './fixtures/app' },
    );
}

export const httpSpec = await createHttpSpec();

afterAll(() => httpSpec.cleanup());
