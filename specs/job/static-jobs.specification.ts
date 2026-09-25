/**
 * Job runner declared with the STATIC array form of the `jobs` option
 * (CONVENTIONS A8) — no factory, no services. The jobs are the specimen's,
 * `specs/shared/fixtures/specimen-job/`.
 */
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';
import { staticJobs } from '../shared/fixtures/specimen-job/jobs.js';

export { staticRuns } from '../shared/fixtures/specimen-job/jobs.js';

export const { cleanup, job } = await specification.job({ jobs: staticJobs });

afterAll(cleanup);
