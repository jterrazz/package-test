import { asOxlintRule, ruleTester } from '../../../rules/rule-tester.fixtures.js';
import { facetIsAComposition } from './facet-is-a-composition.js';

const COMPOSED = `
import { trigger } from './trigger.action.js';
import { clock } from '../../world/clock/clock.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { databaseSet } from '../../world/services/seed/database-set.engine.js';
import { processClock } from '../../world/clock/clock.engine.js';
import type { ChainOf } from '../chain.js';
import { defineFacet } from '../define-facet.js';

const composition = {
    actions: [trigger],
    capabilities: [clock],
    options: { root: { group: 'Constructor option', name: 'root', probe: 'root:' } } satisfies Record<string, unknown>,
} as const;

/** The chain. */
export interface JobSpecification extends ChainOf<typeof composition, never, JobSpecification> {}

export const jobFacet = defineFacet<JobSpecification>()({
    ...composition,
    engines: (config) => ({ clock: processClock, databases: databaseSet(config), jobs: config.jobs ?? [] }),
    locate: getCallerDir,
});
`;

const OPENS = `
import { BaseResult } from '../../expectations/result.js';
import { seed } from '../../world/services/seed/seed.capability.js';
import { jobFacet } from './job.facet.js';

export async function startJob(options) {
    const rows = [1, 2].reduce((sum, value) => sum + value, 0);
    return { job: jobFacet.open({ rows, seeded: seed.name }) };
}
`;

ruleTester().run('facet-is-a-composition', asOxlintRule(facetIsAComposition), {
    invalid: [
        // A helper written in the facet file is logic no other facet shares.
        {
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            errors: [{ messageId: 'stray' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // A value computed beside the composition is a second definition of something.
        {
            code: `${COMPOSED}\nconst DEFAULT_JOBS = [];\n`,
            errors: [{ messageId: 'stray' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // A class, exported or not.
        {
            code: `${COMPOSED}\nexport class JobChain {}\n`,
            errors: [{ messageId: 'stray' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // Engines built in a block of statements, rather than handed back as the adapters.
        {
            code: COMPOSED.replace(
                'engines: (config) => ({ clock: processClock, databases: databaseSet(config), jobs: config.jobs ?? [] }),',
                'engines: (config) => {\n        const jobs = config.jobs ?? [];\n        return { clock: processClock, jobs };\n    },',
            ),
            errors: [{ messageId: 'engines' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // A setup defined inside the composition, its reduce and all, rather than imported from its folder.
        {
            code: COMPOSED.replace(
                'capabilities: [clock],',
                "capabilities: [defineSetup({ name: 'clock', row: {}, reduce: (args, state) => ({ ...state, clock: new Date(String(args[0])).toISOString() }) })],",
            ),
            errors: [{ messageId: 'listed' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // An adapter written inline, however it is nested, and a builder no seam exports.
        {
            code: COMPOSED.replace(
                'clock: processClock,',
                'clock: { pin: (iso) => { const at = new Date(iso); vi.setSystemTime(at); return at; } }, network: clock.build(config),',
            ),
            errors: [{ messageId: 'adapter' }, { messageId: 'adapter' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // Where the facet's paths start, computed in the facet.
        {
            code: COMPOSED.replace(
                'locate: getCallerDir,',
                "locate: () => {\n        const stack = new Error().stack ?? '';\n        return stack.split('\\n')[3] ?? '';\n    },",
            ),
            errors: [{ messageId: 'inline' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // An option whose row is computed, and a member no composition holds.
        {
            code: COMPOSED.replace(
                "options: { root: { group: 'Constructor option', name: 'root', probe: 'root:' } }",
                "options: { root: { group: 'Constructor option', name: 'root', probe: String('root:') } }",
            ).replace('actions: [trigger],', 'actions: [trigger],\n    kernel: clock.reduce,'),
            errors: [{ messageId: 'member' }, { messageId: 'option' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // A default parameter of `engines` runs whatever it is written with, before any adapter.
        {
            code: COMPOSED.replace(
                'engines: (config) => ({ clock: processClock, databases: databaseSet(config), jobs: config.jobs ?? [] }),',
                'engines: ({ jobs = [3, 1].sort().map((x) => x * 2) } = {}) => ({ clock: processClock, jobs }),',
            ),
            errors: [{ messageId: 'engines' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // What `defineFacet` is handed before the facet runs when the module loads.
        {
            code: COMPOSED.replace(
                'defineFacet<JobSpecification>()(',
                'defineFacet<JobSpecification>([1, 2].reduce((a, b) => a + b, 0))(',
            ),
            errors: [{ messageId: 'defined' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // A computed key runs its expression: an option's, a row field's, a facet member's and an adapter's.
        {
            code: COMPOSED.replace(
                "options: { root: { group: 'Constructor option', name: 'root', probe: 'root:' } }",
                "options: { [String([1].map((x) => x + 1))]: { group: 'a', name: 'b', probe: 'c' }, root: { group: 'a', [String(1)]: 'b', probe: 'c' } }",
            )
                .replace(
                    'locate: getCallerDir,',
                    "[(() => { globalThis.x = 1; return 'locate'; })()]: getCallerDir,",
                )
                .replace('clock: processClock,', '[[1].map(String)[0]]: processClock,'),
            errors: [
                { messageId: 'option' },
                { messageId: 'option' },
                { messageId: 'adapter' },
                { messageId: 'inline' },
            ],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        // The constructor running a definition's step, and building a result.
        {
            code: `${OPENS}\nexport function seeded(state, config) {\n    return seed.reduce([], state, { config, engines: {} });\n}\nexport const empty = new BaseResult({ config: {}, testDir: '' });\n`,
            errors: [{ messageId: 'runsStep' }, { messageId: 'buildsResult' }],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
        // A step reached through a namespace import, a destructured step, and one reached through the facet.
        {
            code: `${OPENS}\nimport * as defs from '../../world/services/seed/seed.capability.js';\nexport function steps(state, context) {\n    const { reduce: seeding } = seed;\n    defs.seed.reduce([], state, context);\n    seeding([], state, context);\n    return jobFacet.composition.capabilities[0].reduce([], state, context);\n}\n`,
            errors: [
                { messageId: 'runsStep' },
                { messageId: 'runsStep' },
                { messageId: 'runsStep' },
            ],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
        // A step reached through an alias of the step or of its definition, a destructured default, and a binding written after the call.
        {
            code: `${OPENS}\nexport function early(state, context) {\n    return late([], state, context);\n}\nconst { reduce: late } = seed;\nexport function aliased(state, context) {\n    const run = seed.reduce;\n    const definition = seed;\n    const { reduce = undefined } = seed;\n    run([], state, context);\n    definition.reduce([], state, context);\n    return reduce([], state, context);\n}\n`,
            errors: [
                { messageId: 'runsStep' },
                { messageId: 'runsStep' },
                { messageId: 'runsStep' },
                { messageId: 'runsStep' },
            ],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
        // A step called through `call`, read by a string key or off a cast, and a result built through a namespace import.
        {
            code: `${OPENS}\nimport * as results from '../../expectations/result.js';\nexport function reached(state, context) {\n    seed.reduce.call(undefined, [], state, context);\n    seed['reduce']([], state, context);\n    (seed as any).reduce([], state, context);\n    return new results.BaseResult({ config: {}, testDir: '' });\n}\n`,
            errors: [
                { messageId: 'runsStep' },
                { messageId: 'runsStep' },
                { messageId: 'runsStep' },
                { messageId: 'buildsResult' },
            ],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
    ],
    valid: [
        { code: COMPOSED, filename: '/repo/src/facets/job/job.facet.ts' },
        // An array's own `reduce` is no definition's step.
        { code: OPENS, filename: '/repo/src/facets/job/job.handle.ts' },
        // Only a facet's own folder file is a composition: a sibling module is free.
        {
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            filename: '/repo/src/facets/mobile/projection.ts',
        },
        // And only under this package's `src/facets/`.
        {
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            filename: '/repo/specs/job/job.facet.ts',
        },
    ],
});
