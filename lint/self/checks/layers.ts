import { librariesOwnedIn } from './libraries.js';

export type LayerOptions = {
    /** Each key a direct child folder of the layer, its value the packages that folder may import. */
    folders?: Record<string, string[]>;
    /** A prefix when it ends with `/`, an exact module path otherwise. */
    imports?: string[];
    /** Whole name, or `<name>/…`. */
    packages?: string[];
    /** The lazy seam a layer opens once. */
    seams?: Record<string, string[]>;
};

const CHAIN_AND_KIT = ['chain/', 'lint/kit/'];

/** This package's layer map: `chain ← visitor · expectations · stubs · services · disk · clock · mocks ← vitest ← facets ← the entries`, compiled by `architecture.ts` into the dependency-cruiser rules `jterrazz.config.ts` declares. */
export const FRAMEWORK_LAYERS = {
    chain: {
        folders: {
            context: [],
            // invariant: a scratch folder ends with the test that asked for it (vitest's `onTestFinished`).
            paths: ['vitest'],
            refusals: [],
        },
        imports: CHAIN_AND_KIT,
        // invariant: the four-part lesson a refusal prints is the toolchain's rules kit.
        packages: ['@jterrazz/typescript/rules'],
    },
    visitor: { imports: [...CHAIN_AND_KIT, 'visitor/'] },
    expectations: {
        imports: [...CHAIN_AND_KIT, 'expectations/'],
        packages: ['vitest'],
        seams: {
            // invariant: a table read names its database by the rule a seed names it by: one validation.
            'expectations/result.ts': ['services/database-option'],
            // invariant: a golden is a file the spec names on disk, with the `file()`/`directory()` every verb takes.
            'expectations/goldens/match-options.ts': ['disk/spec-path'],
            'expectations/goldens/matchers.ts': ['disk/spec-path', 'disk/resolved-spec-path'],
            'expectations/goldens/text-assertions.ts': ['disk/spec-path'],
        },
    },
    stubs: {
        imports: [...CHAIN_AND_KIT, 'stubs/'],
        packages: librariesOwnedIn('src/stubs/'),
        seams: {
            // invariant: a stub's request filter is an expectation on the outgoing request: one grammar, never a second.
            'stubs/kinds/http-filter.ts': ['expectations/tokens/'],
            'stubs/kinds/text-filter.ts': ['expectations/tokens/'],
            'stubs/matching/route.ts': ['expectations/tokens/'],
        },
    },
    services: {
        imports: [...CHAIN_AND_KIT, 'services/'],
        // invariant: the container server's reader is a provided value (`vitest`).
        packages: [...librariesOwnedIn('src/services/'), 'vitest'],
        seams: {
            // invariant: a seed is a `.sql` file the spec names on disk, with `file()`.
            'services/seed/database-set.adapter.ts': ['disk/resolved-spec-path'],
            'services/seed/seed.capability.ts': ['disk/spec-path'],
        },
    },
    disk: { imports: [...CHAIN_AND_KIT, 'disk/'] },
    clock: { imports: [...CHAIN_AND_KIT, 'clock/'], packages: ['vitest'] },
    mocks: {
        imports: [...CHAIN_AND_KIT, 'mocks/'],
        packages: ['vitest', ...librariesOwnedIn('src/mocks/')],
    },
    // invariant: a folder owns its files, and no facet lists another.
    facets: {
        folders: {
            api: librariesOwnedIn('src/facets/api/'),
            cli: librariesOwnedIn('src/facets/cli/'),
            component: librariesOwnedIn('src/facets/component/'),
            integration: librariesOwnedIn('src/facets/integration/'),
            job: librariesOwnedIn('src/facets/job/'),
            lint: ['@jterrazz/typescript/rules', ...librariesOwnedIn('src/facets/lint/')],
            mobile: librariesOwnedIn('src/facets/mobile/'),
            website: librariesOwnedIn('src/facets/website/'),
        },
        imports: [
            ...CHAIN_AND_KIT,
            'visitor/',
            'expectations/',
            'stubs/',
            'services/',
            'disk/',
            'clock/',
            'mocks/',
        ],
        packages: ['vitest'],
        seams: {
            'facets/specification.ts': [
                'facets/api/api.handle',
                'facets/cli/cli.handle',
                'facets/integration/integration.handle',
                'facets/job/job.handle',
                'facets/lint/lint.handle',
                'facets/mobile/mobile.handle',
                'facets/website/website.handle',
            ],
            // invariant: a facet reaches the runner config from its project alone: it runs in the Vitest main process, never in test code.
            'facets/api/api.project.ts': ['vitest/project'],
            'facets/cli/cli.project.ts': ['vitest/project'],
            'facets/component/component.project.ts': ['vitest/project'],
            'facets/integration/integration.project.ts': ['vitest/project'],
            'facets/job/job.project.ts': ['vitest/project'],
            'facets/lint/lint.project.ts': ['vitest/project'],
            'facets/mobile/mobile.project.ts': ['vitest/project'],
            'facets/website/website.project.ts': ['vitest/project'],
        },
    },
    vitest: {
        imports: [
            'vitest/',
            'chain/',
            // invariant: update mode's global setup, which every project carries.
            'expectations/in-place/in-place-setup',
            'lint/kit/',
        ],
        // invariant: the ground folders every project skips are the toolchain's rules kit.
        packages: ['vitest', '@jterrazz/typescript/rules'],
    },
    lint: {
        imports: ['lint/'],
        // invariant: oxlint's plugin types and the toolchain's config type (erased), and the module parser.
        packages: [
            '@oxlint/plugins',
            '@jterrazz/typescript/config',
            '@jterrazz/typescript/oxlint',
            'vitest',
            ...librariesOwnedIn('lint/'),
        ],
        seams: {
            'lint/self/corpus/compositions.ts': ['facets/', 'chain/define-facet'],
            'lint/self/self-cli.ts': ['chain/refusals/rows'],
        },
    },
} satisfies Record<string, LayerOptions>;
