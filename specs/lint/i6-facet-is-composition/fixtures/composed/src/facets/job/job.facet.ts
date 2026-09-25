import { trigger } from './trigger.action.js';
import { clock } from '../../world/clock/clock.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { processClock } from '../../world/clock/clock.engine.js';
import type { ChainOf } from '../chain.js';
import { defineFacet } from '../define-facet.js';

const composition = {
    actions: [trigger],
    capabilities: [clock],
    options: {},
} as const;

/** The chain `specification.job()` hands out. */
export interface JobSpecification extends ChainOf<typeof composition, never, JobSpecification> {}

export const jobFacet = defineFacet<JobSpecification>()({
    ...composition,
    engines: (config: { jobs?: string[] }) => ({ clock: processClock, jobs: config.jobs ?? [] }),
    locate: getCallerDir,
});
