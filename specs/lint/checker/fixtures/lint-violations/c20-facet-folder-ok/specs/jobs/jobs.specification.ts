import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { jobs as registry } from '../../src/jobs.js';

export const { cleanup, jobs } = await specification.jobs({ jobs: () => registry });

afterAll(cleanup);
