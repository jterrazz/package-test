/* oxlint-disable typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import type { MatrixRow } from '../../chain/capability.js';
import type { ChainOf } from '../../chain/chain.js';
import type { Started } from '../../chain/config.js';
import { defineFacet } from '../../chain/define-facet.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { fixture } from '../../disk/fixture.capability.js';
import { fsFixtures } from '../../disk/fs-fixtures.adapter.js';
import type { LintFacetConfig, LintSpecificationOptions } from './lint.handle.js';
import { rules } from './rules.capability.js';
import { run } from './run.action.js';

const composition = {
    actions: [run],
    capabilities: [fixture, rules],
    options: {
        checkers: { group: 'Constructor option', name: 'checkers', probe: 'checkers:' },
        config: { group: 'Constructor option', name: 'config', probe: 'config:' },
        plugins: { group: 'Constructor option', name: 'plugins', probe: 'plugins:' },
        presets: { group: 'Constructor option', name: 'presets', probe: 'presets:' },
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        settings: { group: 'Constructor option', name: 'settings', probe: 'settings:' },
    } satisfies Record<keyof LintSpecificationOptions, MatrixRow>,
} as const;

/** The chain `specification.lint()` hands out: a fixture tree, linted in a fresh working directory. */
export interface LintSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    LintSpecification
> {}

export const lintFacet = defineFacet<LintSpecification, Started<LintFacetConfig, 'linters'>>()({
    ...composition,
    adapters: (config: Started<LintFacetConfig, 'linters'>) => ({
        linters: config.linters,
        workdir: fsFixtures,
    }),
    locate: getCallerDir,
});
