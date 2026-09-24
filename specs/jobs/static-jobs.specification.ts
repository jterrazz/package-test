/**
 * Jobs runner declared with the STATIC array form of the `jobs` option
 * (CONVENTIONS A8) — no factory, no services. The jobs are the specimen's,
 * `specs/shared/fixtures/specimen-jobs/`.
 */
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';
import { staticJobs } from '../shared/fixtures/specimen-jobs/jobs.js';

export { staticRuns } from '../shared/fixtures/specimen-jobs/jobs.js';

export const { cleanup, jobs } = await specification.jobs({ jobs: staticJobs });

afterAll(cleanup);
