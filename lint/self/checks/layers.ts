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

/** This package's layer map: `kernel ← world · visitor · expectations ← vitest ← facets ← the entries`, compiled by `architecture.ts` into the dependency-cruiser rules `jterrazz.config.ts` declares. */
export const FRAMEWORK_LAYERS = {
    kernel: {
        folders: {
            chain: [],
            context: [],
            // A scratch folder ends with the test that asked for it (vitest's `onTestFinished`).
            files: ['vitest'],
            refusals: [],
        },
        imports: ['kernel/', 'lint/engine/', 'lint/refusal'],
        // The four-part lesson a refusal prints is the toolchain's rules kit.
        packages: ['@jterrazz/typescript/rules'],
    },
    world: {
        folders: {
            clock: ['vitest'],
            mocks: ['vitest', ...librariesOwnedIn('src/world/mocks/')],
            // The container server's reader is a provided value (`vitest`).
            services: [...librariesOwnedIn('src/world/services/'), 'vitest'],
            stubs: librariesOwnedIn('src/world/stubs/'),
        },
        imports: ['kernel/', 'lint/engine/', 'lint/refusal'],
        seams: {
            // A stub's request filter is an expectation on the outgoing request: one grammar, never a second.
            'world/stubs/kinds/http.ts': ['expectations/tokens/'],
            'world/stubs/kinds/text-filter.ts': ['expectations/tokens/'],
            'world/stubs/matching/route.ts': ['expectations/tokens/'],
        },
    },
    visitor: { imports: ['kernel/', 'visitor/', 'lint/engine/', 'lint/refusal'] },
    expectations: {
        imports: ['kernel/', 'expectations/', 'lint/engine/', 'lint/refusal'],
        packages: ['vitest'],
    },
    // A folder owns its files, and no facet lists another.
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
        imports: ['kernel/', 'world/', 'visitor/', 'expectations/', 'lint/engine/', 'lint/refusal'],
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
            // A facet reaches the runner config from its project alone: it runs in the Vitest main process, never in test code.
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
            'kernel/',
            // Update mode's global setup, which every project carries.
            'expectations/in-place/in-place-setup',
            'lint/engine/',
        ],
        // The ground folders every project skips are the toolchain's rules kit.
        packages: ['vitest', '@jterrazz/typescript/rules'],
    },
    lint: {
        imports: ['lint/'],
        // oxlint's plugin types and the toolchain's config type (erased), and the module parser.
        packages: [
            '@oxlint/plugins',
            '@jterrazz/typescript/config',
            '@jterrazz/typescript/oxlint',
            'vitest',
            ...librariesOwnedIn('lint/'),
        ],
        seams: { 'lint/self/corpus/compositions.ts': ['facets/', 'kernel/chain/define-facet'] },
    },
} satisfies Record<string, LayerOptions>;
