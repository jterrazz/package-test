/**
 * Shared HTTP specification — the app is handed to the runner in this process,
 * and the services it reads are declared here (CONVENTIONS A8).
 */
import { afterAll } from 'vitest';

import { postgres, redis, specification } from '../../src/index.js';
import { createApp } from '../_fixtures/app/app.js';

export const { api, cleanup } = await specification.api({
    root: '../_fixtures/app',
    server: ({ analyticsDb, cache, db }) =>
        createApp({
            analyticsDatabaseUrl: analyticsDb.connectionString,
            databaseUrl: db.connectionString,
            redisUrl: cache.connectionString,
        }),
    services: {
        // Insertion order matters: the first database handle is the default
        // Target of internal resets; _seeds/tables always name their database
        // Explicitly here because two postgres handles are declared (A7).
        // The `analyticsDb` key auto-binds to the `analytics-db` compose
        // The record KEY is the service name, in kebab-case (A8).
        analyticsDb: postgres(),
        cache: redis(),
        db: postgres(),
    },
});

afterAll(cleanup);
