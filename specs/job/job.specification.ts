import { postgres, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { databaseJobs } from './_fixtures/specimen-job/database-jobs.js';

// invariant: the record key, kebab-cased, is the service name (`server-sees-declared-services`).
export const analyticsHandle = postgres();

export const { cleanup, job } = await specification.job({
    jobs: databaseJobs,
    root: '../_shared/_fixtures/specimen-api',
    services: {
        analyticsDb: analyticsHandle,
        db: postgres(),
    },
});

afterAll(cleanup);
