import { afterAll } from 'vitest';

import { postgres, redis, specification } from '../../src/index.js';
import { createApp } from '../_shared/_fixtures/specimen-api/app.js';

export const { api, cleanup } = await specification.api({
    root: '../_shared/_fixtures/specimen-api',
    server: ({ analyticsDb, cache, db }) =>
        createApp({
            analyticsDatabaseUrl: analyticsDb.connectionString,
            databaseUrl: db.connectionString,
            redisUrl: cache.connectionString,
        }),
    services: {
        // The first database handle is the default target of internal resets; the record key, kebab-cased, is the service name (`server-sees-declared-services`).
        analyticsDb: postgres(),
        cache: redis(),
        db: postgres(),
    },
});

afterAll(cleanup);
