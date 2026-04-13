import { afterAll } from 'vitest';

import { app, postgres, redis, spec } from '../../src/index.js';
import { createApp } from './fixtures/app/app.js';

const db = postgres({ compose: 'db' });
const analyticsDb = postgres({ compose: 'analytics-db' });
const cache = redis({ compose: 'cache' });

export const httpSpec = await spec(
    app(() =>
        createApp({
            databaseUrl: db.connectionString,
            analyticsDatabaseUrl: analyticsDb.connectionString,
            redisUrl: cache.connectionString,
        }),
    ),
    { services: [db, analyticsDb, cache], root: './fixtures/app' },
);

afterAll(() => httpSpec.cleanup());
