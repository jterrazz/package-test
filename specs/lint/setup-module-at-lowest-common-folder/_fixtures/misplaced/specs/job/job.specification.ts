import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, job } = await specification.job({ jobs: () => [] });

afterAll(cleanup);
