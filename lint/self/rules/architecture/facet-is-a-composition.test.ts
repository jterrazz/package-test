import { ruleTester } from '@jterrazz/test';

import { facetIsAComposition } from './facet-is-a-composition.js';

const COMPOSED = `
import { trigger } from './trigger.action.js';
import { clock } from '../../clock/clock.capability.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { databaseSet } from '../../services/seed/database-set.adapter.js';
import { processClock } from '../../clock/process-clock.adapter.js';
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
    adapters: (config) => ({ clock: processClock, databases: databaseSet(config), jobs: config.jobs ?? [] }),
    locate: getCallerDir,
});
`;

const OPENS = `
import { BaseResult } from '../../expectations/result.js';
import { seed } from '../../services/seed/seed.capability.js';
import { jobFacet } from './job.facet.js';

export async function startJob(options) {
    const rows = [1, 2].reduce((sum, value) => sum + value, 0);
    return { job: jobFacet.open({ rows, seeded: seed.name }) };
}
`;

ruleTester().run('facet-is-a-composition', facetIsAComposition, {
    invalid: [
        {
            name: 'A helper written in the facet file is logic no other facet shares.',
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            errors: [{ column: 0, line: 25, messageId: 'stray' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'A value computed beside the composition is a second definition of something.',
            code: `${COMPOSED}\nconst DEFAULT_JOBS = [];\n`,
            errors: [{ column: 0, line: 25, messageId: 'stray' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'A class, exported or not.',
            code: `${COMPOSED}\nexport class JobChain {}\n`,
            errors: [{ column: 0, line: 25, messageId: 'stray' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'Adapters built in a block of statements, rather than handed back as the adapters.',
            code: COMPOSED.replace(
                'adapters: (config) => ({ clock: processClock, databases: databaseSet(config), jobs: config.jobs ?? [] }),',
                'adapters: (config) => {\n        const jobs = config.jobs ?? [];\n        return { clock: processClock, jobs };\n    },',
            ),
            errors: [{ column: 56, line: 19, messageId: 'adapters' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'A setup defined inside the composition, its reduce and all, rather than imported from its folder.',
            code: COMPOSED.replace(
                'capabilities: [clock],',
                "capabilities: [defineSetup({ name: 'clock', row: {}, reduce: (args, state) => ({ ...state, clock: new Date(String(args[0])).toISOString() }) })],",
            ),
            errors: [{ column: 19, line: 12, messageId: 'listed' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'An adapter written inline, however it is nested, and a builder no seam exports.',
            code: COMPOSED.replace(
                'clock: processClock,',
                'clock: { pin: (iso) => { const at = new Date(iso); vi.setSystemTime(at); return at; } }, network: clock.build(config),',
            ),
            errors: [
                { column: 29, line: 21, messageId: 'adapter' },
                { column: 118, line: 21, messageId: 'adapter' },
            ],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: "Where the facet's paths start, computed in the facet.",
            code: COMPOSED.replace(
                'locate: getCallerDir,',
                "locate: () => {\n        const stack = new Error().stack ?? '';\n        return stack.split('\\n')[3] ?? '';\n    },",
            ),
            errors: [{ column: 4, line: 22, messageId: 'inline' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'An option whose row is computed, and a member no composition holds.',
            code: COMPOSED.replace(
                "options: { root: { group: 'Constructor option', name: 'root', probe: 'root:' } }",
                "options: { root: { group: 'Constructor option', name: 'root', probe: String('root:') } }",
            ).replace('actions: [trigger],', 'actions: [trigger],\n    chain: clock.reduce,'),
            errors: [
                { column: 4, line: 12, messageId: 'member' },
                { column: 15, line: 14, messageId: 'option' },
            ],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'A default parameter of `adapters` runs whatever it is written with, before any adapter.',
            code: COMPOSED.replace(
                'adapters: (config) => ({ clock: processClock, databases: databaseSet(config), jobs: config.jobs ?? [] }),',
                'adapters: ({ jobs = [3, 1].sort().map((x) => x * 2) } = {}) => ({ clock: processClock, jobs }),',
            ),
            errors: [{ column: 56, line: 19, messageId: 'adapters' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: 'What `defineFacet` is handed before the facet runs when the module loads.',
            code: COMPOSED.replace(
                'defineFacet<JobSpecification>()(',
                'defineFacet<JobSpecification>([1, 2].reduce((a, b) => a + b, 0))(',
            ),
            errors: [{ column: 54, line: 19, messageId: 'defined' }],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: "A computed key runs its expression: an option's, a row field's, a facet member's and an adapter's.",
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
                { column: 15, line: 13, messageId: 'option' },
                { column: 87, line: 13, messageId: 'option' },
                { column: 29, line: 21, messageId: 'adapter' },
                { column: 4, line: 22, messageId: 'inline' },
            ],
            filename: '/repo/src/facets/job/job.facet.ts',
        },
        {
            name: "The constructor running a definition's step, and building a result.",
            code: `${OPENS}\nexport function seeded(state, config) {\n    return seed.reduce([], state, { config, adapters: {} });\n}\nexport const empty = new BaseResult({ config: {}, testDir: '' });\n`,
            errors: [
                { column: 11, line: 12, messageId: 'runsStep' },
                { column: 21, line: 14, messageId: 'buildsResult' },
            ],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
        {
            name: 'A step reached through a namespace import, a destructured step, and one reached through the facet.',
            code: `${OPENS}\nimport * as defs from '../../services/seed/seed.capability.js';\nexport function steps(state, context) {\n    const { reduce: seeding } = seed;\n    defs.seed.reduce([], state, context);\n    seeding([], state, context);\n    return jobFacet.composition.capabilities[0].reduce([], state, context);\n}\n`,
            errors: [
                { column: 4, line: 14, messageId: 'runsStep' },
                { column: 4, line: 15, messageId: 'runsStep' },
                { column: 11, line: 16, messageId: 'runsStep' },
            ],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
        {
            name: 'A step reached through an alias of the step or of its definition, a destructured default, and a binding written after the call.',
            code: `${OPENS}\nexport function early(state, context) {\n    return late([], state, context);\n}\nconst { reduce: late } = seed;\nexport function aliased(state, context) {\n    const run = seed.reduce;\n    const definition = seed;\n    const { reduce = undefined } = seed;\n    run([], state, context);\n    definition.reduce([], state, context);\n    return reduce([], state, context);\n}\n`,
            errors: [
                { column: 11, line: 12, messageId: 'runsStep' },
                { column: 4, line: 19, messageId: 'runsStep' },
                { column: 4, line: 20, messageId: 'runsStep' },
                { column: 11, line: 21, messageId: 'runsStep' },
            ],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
        {
            name: 'A step called through `call`, read by a string key or off a cast, and a result built through a namespace import.',
            code: `${OPENS}\nimport * as results from '../../expectations/result.js';\nexport function reached(state, context) {\n    seed.reduce.call(undefined, [], state, context);\n    seed['reduce']([], state, context);\n    (seed as any).reduce([], state, context);\n    return new results.BaseResult({ config: {}, testDir: '' });\n}\n`,
            errors: [
                { column: 4, line: 13, messageId: 'runsStep' },
                { column: 4, line: 14, messageId: 'runsStep' },
                { column: 4, line: 15, messageId: 'runsStep' },
                { column: 11, line: 16, messageId: 'buildsResult' },
            ],
            filename: '/repo/src/facets/job/job.handle.ts',
        },
    ],
    valid: [
        { code: COMPOSED, filename: '/repo/src/facets/job/job.facet.ts' },
        {
            name: "An array's own `reduce` is no definition's step.",
            code: OPENS,
            filename: '/repo/src/facets/job/job.handle.ts',
        },
        {
            name: "Only a facet's own folder file is a composition: a sibling module is free.",
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            filename: '/repo/src/facets/mobile/projection.ts',
        },
        {
            name: "And only under this package's `src/facets/`.",
            code: `${COMPOSED}\nfunction pinned(iso) {\n    return iso;\n}\n`,
            filename: '/repo/specs/job/job.facet.ts',
        },
    ],
});
