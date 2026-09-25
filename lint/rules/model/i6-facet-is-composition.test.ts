import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { i6FacetIsComposition } from './i6-facet-is-composition.js';

/** A facet file as the architecture writes it: imports, the composition, the chain, the definition. */
const COMPOSED = `
import { trigger } from '../../actions/trigger/trigger.action.js';
import { clock } from '../../capabilities/clock/clock.capability.js';
import { processClock } from '../../seams/vitest/clock.engine.js';
import type { ChainOf } from '../chain.js';
import { defineFacet } from '../define-facet.js';

const composition = {
    actions: [trigger],
    capabilities: [clock],
    options: { root: { group: 'Constructor option', name: 'root', probe: 'root:' } } satisfies Record<string, unknown>,
} as const;

/** The chain. */
export interface JobsSpecification extends ChainOf<typeof composition, never, JobsSpecification> {}

export const jobsFacet = defineFacet<JobsSpecification>()({
    ...composition,
    engines: (config) => ({ clock: processClock, jobs: config.jobs ?? [] }),
    locate: () => '',
});
`;

/** A constructor that opens its facet. */
const OPENS = `
import { BaseResult } from '../../results/result.js';
import { seed } from '../../capabilities/seed/seed.capability.js';
import { jobsFacet } from './jobs.facet.js';

export async function startJobs(options) {
    const rows = [1, 2].reduce((sum, value) => sum + value, 0);
    return { jobs: jobsFacet.open({ rows, seeded: seed.name }) };
}
`;

ruleTester().run('i6-facet-is-composition', asOxlintRule(i6FacetIsComposition), {
    invalid: [
        // A helper written in the facet file is logic no other facet shares.
        {
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            errors: [{ messageId: 'stray' }],
            filename: '/repo/src/facets/jobs/jobs.facet.ts',
        },
        // A value computed beside the composition is a second definition of something.
        {
            code: `${COMPOSED}\nconst DEFAULT_JOBS = [];\n`,
            errors: [{ messageId: 'stray' }],
            filename: '/repo/src/facets/jobs/jobs.facet.ts',
        },
        // A class, exported or not.
        {
            code: `${COMPOSED}\nexport class JobsChain {}\n`,
            errors: [{ messageId: 'stray' }],
            filename: '/repo/src/facets/jobs/jobs.facet.ts',
        },
        // Engines built in a block of statements, rather than handed back as the adapters.
        {
            code: COMPOSED.replace(
                'engines: (config) => ({ clock: processClock, jobs: config.jobs ?? [] }),',
                'engines: (config) => {\n        const jobs = config.jobs ?? [];\n        return { clock: processClock, jobs };\n    },',
            ),
            errors: [{ messageId: 'engines' }],
            filename: '/repo/src/facets/jobs/jobs.facet.ts',
        },
        // The constructor running a definition's step, and building a result.
        {
            code: `${OPENS}\nexport function seeded(state, config) {\n    return seed.reduce([], state, { config, engines: {} });\n}\nexport const empty = new BaseResult({ config: {}, testDir: '' });\n`,
            errors: [{ messageId: 'runsStep' }, { messageId: 'buildsResult' }],
            filename: '/repo/src/facets/jobs/jobs.handle.ts',
        },
    ],
    valid: [
        { code: COMPOSED, filename: '/repo/src/facets/jobs/jobs.facet.ts' },
        // An array's own `reduce` is no definition's step.
        { code: OPENS, filename: '/repo/src/facets/jobs/jobs.handle.ts' },
        // Only a facet's own folder file is a composition: a sibling module is free.
        {
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            filename: '/repo/src/facets/mobile/projection.ts',
        },
        // And only under this package's `src/facets/`.
        {
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            filename: '/repo/specs/jobs/jobs.facet.ts',
        },
    ],
});
