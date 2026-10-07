import { postgres, redis, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { createApp } from '../__fixtures__/specimen-api/app.js';

export const { api, cleanup } = await specification.api({
    root: '../__fixtures__/specimen-api',
    server: ({ analyticsDb, cache, db }) =>
        createApp({
            analyticsDatabaseUrl: analyticsDb.connectionString,
            databaseUrl: db.connectionString,
            redisUrl: cache.connectionString,
        }),
    services: {
        // invariant: the first database handle is the default target of internal resets; the record key, kebab-cased, is the service name (`server-sees-declared-services`).
        analyticsDb: postgres(),
        cache: redis(),
        db: postgres(),
    },
});

afterAll(cleanup);
