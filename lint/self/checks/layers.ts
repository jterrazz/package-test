import { librariesOwnedIn } from './libraries.js';

export type LayerOptions = {
    /** Each key a direct child folder of the layer, its value the packages that folder may import. */
    folders?: Record<string, string[]>;
    /** A prefix when it ends with `/`, an exact module path otherwise. */
    imports?: string[];
    /** Whole name, or `<name>/...`. */
    packages?: string[];
    /** The lazy seam a layer opens once. */
    seams?: Record<string, string[]>;
};

const CHAIN_AND_KIT = ['chain/', 'lint/kit/'];

/** This package's layer map: `chain ← visitor · expectations · stubs · services · disk · clock · mocks ← vitest ← specifications ← the entries`, compiled by `architecture.ts` into the dependency-cruiser rules `jterrazz.config.ts` declares. */
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
            'expectations/goldens/file-goldens.ts': ['disk/resolved-spec-path'],
            'expectations/goldens/matchers.ts': ['disk/spec-path'],
            'expectations/goldens/response-goldens.ts': ['disk/resolved-spec-path'],
            'expectations/goldens/text-assertions.ts': ['disk/spec-path'],
            // invariant: the containers a subject started are read through the one module that runs `docker`, which the containers the test declares share.
            'expectations/command/cli.result.ts': ['services/containers/docker-cli'],
            'expectations/command/container.ts': ['services/containers/docker-cli'],
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
    // invariant: a folder owns its files, and no specification lists another.
    specifications: {
        folders: {
            api: librariesOwnedIn('src/specifications/api/'),
            cli: librariesOwnedIn('src/specifications/cli/'),
            component: librariesOwnedIn('src/specifications/component/'),
            integration: librariesOwnedIn('src/specifications/integration/'),
            job: librariesOwnedIn('src/specifications/job/'),
            lint: ['@jterrazz/typescript/rules', ...librariesOwnedIn('src/specifications/lint/')],
            mobile: librariesOwnedIn('src/specifications/mobile/'),
            website: librariesOwnedIn('src/specifications/website/'),
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
            'specifications/specification.ts': [
                'specifications/api/api.handle',
                'specifications/cli/cli.handle',
                'specifications/integration/integration.handle',
                'specifications/job/job.handle',
                'specifications/lint/lint.handle',
                'specifications/mobile/mobile.handle',
                'specifications/website/website.handle',
            ],
            // invariant: a specification reaches the runner config from its project alone: it runs in the Vitest main process, never in test code.
            'specifications/api/api.project.ts': ['vitest/project'],
            'specifications/cli/cli.project.ts': ['vitest/project'],
            'specifications/component/component.project.ts': ['vitest/project'],
            'specifications/integration/integration.project.ts': ['vitest/project'],
            'specifications/job/job.project.ts': ['vitest/project'],
            'specifications/lint/lint.project.ts': ['vitest/project'],
            'specifications/mobile/mobile.project.ts': ['vitest/project'],
            'specifications/website/website.project.ts': ['vitest/project'],
        },
    },
    vitest: {
        imports: [
            'vitest/',
            'chain/',
            // invariant: update mode's global setup, which every project carries.
            'expectations/in-place/in-place.global-setup',
            'lint/kit/',
        ],
        // invariant: the ground folders every project skips are the toolchain's rules kit.
        packages: ['vitest', '@jterrazz/typescript/rules'],
    },
    // invariant: the standard is data, typed by the toolchain's config entry, and reads no layer.
    standard: { packages: ['@jterrazz/typescript/config'] },
    lint: {
        imports: ['lint/', 'standard/'],
        // invariant: oxlint's plugin types and the toolchain's config type (erased), and the module parser.
        packages: [
            '@oxlint/plugins',
            '@jterrazz/typescript/config',
            '@jterrazz/typescript/oxlint',
            'vitest',
            ...librariesOwnedIn('lint/'),
        ],
        seams: {
            'lint/self/corpus/compositions.ts': [
                'specifications/',
                'specifications/api/deployed/deployed.composition',
                'chain/define-specification',
            ],
            'lint/self/self.cli.ts': ['chain/refusals/rows'],
        },
    },
} satisfies Record<string, LayerOptions>;
