import { jobsFacet } from './jobs.facet.js';

/** Start the jobs and open the facet over them. */
export function startJobs(jobs: string[]): unknown {
    return jobsFacet.open({ jobs });
}
