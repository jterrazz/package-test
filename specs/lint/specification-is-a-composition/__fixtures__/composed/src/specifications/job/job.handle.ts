import { jobDefinition } from './job.composition.js';

/** Start the jobs and open the specification over them. */
export function startJob(jobs: string[]): unknown {
    return jobDefinition.open({ jobs });
}
