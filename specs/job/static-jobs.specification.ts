import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';
import { staticJobs } from '../shared/fixtures/specimen-job/jobs.js';

export { staticRuns } from '../shared/fixtures/specimen-job/jobs.js';

export const { cleanup, job } = await specification.job({ jobs: staticJobs });

afterAll(cleanup);
