import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { jobs as registry } from '../../src/jobs.js';

export const { cleanup, job } = await specification.job({ jobs: () => registry });

afterAll(cleanup);
