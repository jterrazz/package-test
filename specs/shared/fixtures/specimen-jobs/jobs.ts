/**
 * A specimen of the jobs facet declared as a STATIC array — no factory, no
 * services: one job recording that it ran, one refusing by its own name.
 */
import type { JobHandle } from '../../../../src/index.js';

/** Names of the static jobs that ran — observable from specs. */
export const staticRuns: string[] = [];

/** A job whose `execute` is a method: it reads its own fields through `this`. */
class RefusingJob implements JobHandle {
    readonly name = 'refuse-by-name';

    async execute(): Promise<void> {
        await Promise.reject(new Error(`${this.name}: refused`));
    }
}

/** The jobs, in the static form of the `jobs` option. */
export const staticJobs: JobHandle[] = [
    {
        execute: async () => {
            staticRuns.push('record-run');
        },
        name: 'record-run',
    },
    new RefusingJob(),
];
