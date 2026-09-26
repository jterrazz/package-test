import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';
import { staticJobs } from '../_shared/_fixtures/specimen-job/jobs.js';

export { staticRuns } from '../_shared/_fixtures/specimen-job/jobs.js';

export const { cleanup, job } = await specification.job({ jobs: staticJobs });

afterAll(cleanup);
