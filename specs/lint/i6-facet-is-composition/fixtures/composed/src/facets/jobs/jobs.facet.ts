import { trigger } from '../../actions/trigger/trigger.action.js';
import { clock } from '../../capabilities/clock/clock.capability.js';
import { processClock } from '../../seams/vitest/clock.engine.js';
import type { ChainOf } from '../chain.js';
import { defineFacet } from '../define-facet.js';

const composition = {
    actions: [trigger],
    capabilities: [clock],
    options: {},
} as const;

/** The chain `specification.jobs()` hands out. */
export interface JobsSpecification extends ChainOf<typeof composition, never, JobsSpecification> {}

export const jobsFacet = defineFacet<JobsSpecification>()({
    ...composition,
    engines: (config: { jobs?: string[] }) => ({ clock: processClock, jobs: config.jobs ?? [] }),
    locate: () => '',
});
