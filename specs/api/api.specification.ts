/**
 * Shared HTTP specification. One code path for both execution modes — the
 * mode switch lives in vitest.config.ts (`env: { TEST_MODE: 'compose' }` for
 * the http-stack project), never here (CONVENTIONS A5).
 */
import { afterAll } from 'vitest';

import { createApp } from '../_fixtures/app/app.js';
import { postgres, redis, specification } from '../../src/index.js';

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
        // Service via kebab-case derivation — no composeService needed (A6).
        analyticsDb: postgres(),
        cache: redis(),
        db: postgres(),
    },
});

afterAll(cleanup);
