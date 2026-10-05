import { trigger } from './trigger.action.js';
import { clock } from '../../clock/clock.capability.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { processClock } from '../../clock/process-clock.adapter.js';
import type { ChainOf } from '../chain.js';
import { defineSpecification } from '../define-specification.js';

const composition = {
    actions: [trigger],
    capabilities: [clock],
    options: {},
} as const;

/** The chain `specification.job()` hands out. */
export interface JobSpecification extends ChainOf<typeof composition, never, JobSpecification> {}

/** The jobs a chain may trigger, sorted by name. */
function sorted(jobs: string[]): string[] {
    return jobs.toSorted();
}

export const jobDefinition = defineSpecification<JobSpecification>()({
    ...composition,
    adapters: (config: { jobs?: string[] }) => ({ clock: processClock, jobs: sorted(config.jobs ?? []) }),
    locate: getCallerDir,
});
