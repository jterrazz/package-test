import { trigger } from '../../actions/trigger/trigger.action.js';
import { BaseResult } from '../../results/result.js';
import { jobFacet } from './job.facet.js';

/** Start the jobs, run one of them, and open the facet over them. */
export async function startJob(jobs: string[]): Promise<unknown> {
    await trigger.perform(['nightly'], () => [], { jobs }, { testDir: '' });
    const warmed = new BaseResult({ testDir: '' });
    return { job: jobFacet.open({ jobs }), warmed };
}
