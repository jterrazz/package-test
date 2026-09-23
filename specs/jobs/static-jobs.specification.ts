/**
 * Jobs runner declared with the STATIC array form of the `jobs` option
 * (CONVENTIONS A8) — no factory, no services.
 */
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';
import type { JobHandle } from '../../src/index.js';

/** Names of the static jobs that ran — observable from specs. */
export const staticRuns: string[] = [];

/** A job whose `execute` is a method: it reads its own fields through `this`. */
class RefusingJob implements JobHandle {
    readonly name = 'refuse-by-name';

    async execute(): Promise<void> {
        await Promise.reject(new Error(`${this.name}: refused`));
    }
}

const staticJobs: JobHandle[] = [
    {
        execute: async () => {
            staticRuns.push('record-run');
        },
        name: 'record-run',
    },
    new RefusingJob(),
];

export const { cleanup, jobs } = await specification.jobs({ jobs: staticJobs });

afterAll(cleanup);
