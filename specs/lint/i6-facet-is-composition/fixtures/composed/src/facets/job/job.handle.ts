import { jobFacet } from './job.facet.js';

/** Start the jobs and open the facet over them. */
export function startJob(jobs: string[]): unknown {
    return jobFacet.open({ jobs });
}
