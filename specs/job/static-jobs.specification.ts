import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { staticJobs } from './__fixtures__/specimen-job/jobs.js';

export { staticRuns } from './__fixtures__/specimen-job/jobs.js';

export const { cleanup, job } = await specification.job({ jobs: staticJobs });

afterAll(cleanup);
