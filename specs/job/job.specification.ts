import { afterAll } from 'vitest';

import { postgres, specification } from '../../src/index.js';
import { databaseJobs } from '../shared/fixtures/specimen-job/database-jobs.js';

// The record key, kebab-cased, is the service name (A8).
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
