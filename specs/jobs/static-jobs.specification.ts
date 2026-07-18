/**
 * Jobs runner declared with the STATIC array form of the `jobs` option
 * (CONVENTIONS A8) — no factory, no services.
 */
import { afterAll } from 'vitest';

import { type JobHandle, specification } from '../../src/index.js';

/** Names of the static jobs that ran — observable from specs. */
export const staticRuns: string[] = [];

const staticJobs: JobHandle[] = [
    {
        execute: async () => {
            staticRuns.push('record-run');
        },
        name: 'record-run',
    },
];

export const { cleanup, jobs } = await specification.jobs({ jobs: staticJobs });

afterAll(cleanup);
