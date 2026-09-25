/**
 * Shared job specification — `specification.job()` has no HTTP server and
 * jobs run in-process by definition (CONVENTIONS A8). The jobs are the
 * specimen's, `specs/shared/fixtures/specimen-job/database-jobs.ts`.
 */
import { afterAll } from 'vitest';

import { postgres, specification } from '../../src/index.js';
import { databaseJobs } from '../shared/fixtures/specimen-job/database-jobs.js';

// The `analyticsDb` key auto-binds to the `analytics-db` compose service via
// The record KEY is the service name, in kebab-case (CONVENTIONS A8).
export const analyticsHandle = postgres();

export const { cleanup, job } = await specification.job({
    jobs: databaseJobs,
    root: '../shared/fixtures/specimen-api',
    services: {
        analyticsDb: analyticsHandle,
        db: postgres(),
    },
});

afterAll(cleanup);
