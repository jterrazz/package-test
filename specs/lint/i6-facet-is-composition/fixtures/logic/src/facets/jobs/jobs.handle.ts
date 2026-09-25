import { trigger } from '../../actions/trigger/trigger.action.js';
import { BaseResult } from '../../results/result.js';
import { jobsFacet } from './jobs.facet.js';

/** Start the jobs, run one of them, and open the facet over them. */
export async function startJobs(jobs: string[]): Promise<unknown> {
    await trigger.perform(['nightly'], () => [], { jobs }, { testDir: '' });
    const warmed = new BaseResult({ testDir: '' });
    return { jobs: jobsFacet.open({ jobs }), warmed };
}
