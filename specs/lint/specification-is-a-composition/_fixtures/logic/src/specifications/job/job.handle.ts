import { trigger } from './trigger.action.js';
import { BaseResult } from '../../expectations/result.js';
import { jobDefinition } from './job.composition.js';

/** Start the jobs, run one of them, and open the specification over them. */
export async function startJob(jobs: string[]): Promise<unknown> {
    await trigger.perform(['nightly'], () => [], { jobs }, { testDir: '' });
    const warmed = new BaseResult({ testDir: '' });
    return { job: jobDefinition.open({ jobs }), warmed };
}
