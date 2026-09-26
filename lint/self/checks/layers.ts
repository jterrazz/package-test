import type { LayerOptions } from '../../consumer/rules/architecture/import-within-declared-layers.js';
import { librariesOwnedIn } from './libraries.js';

/** This package's layer map (`import-within-declared-layers`), which `oxlint.config.ts` hands the rule: `kernel ← world · elements · expectations ← facets ← vitest · the entries`. What a map cannot express is the self checker's, `SELF_CHECKER_PASS_IDS` in `checker.ts`; library ownership is read off `OWNERS_OF_LIBRARIES`. */
export const FRAMEWORK_LAYERS = {
    kernel: {
        folders: {
            chain: [],
            context: [],
            // A scratch folder ends with the test that asked for it (vitest's `onTestFinished`).
            files: ['vitest'],
            refusals: [],
        },
        imports: ['kernel/', 'lint/engine/', 'lint/index.refusal'],
    },
    world: {
        folders: {
            clock: ['vitest'],
            mocks: ['vitest', ...librariesOwnedIn('src/world/mocks/')],
            // The container server's reader is a provided value (`vitest`).
            services: [...librariesOwnedIn('src/world/services/'), 'vitest'],
            stubs: librariesOwnedIn('src/world/stubs/'),
        },
        imports: ['kernel/', 'lint/engine/', 'lint/index.refusal'],
        seams: {
            // A stub's request filter is an expectation on the outgoing request: one grammar, never a second.
            'world/stubs/exchange/queue.ts': ['expectations/tokens/'],
            'world/stubs/filters.ts': ['expectations/tokens/'],
            'world/stubs/http/http.ts': ['expectations/tokens/'],
        },
    },
    elements: { imports: ['kernel/', 'elements/', 'lint/engine/', 'lint/index.refusal'] },
    expectations: {
        imports: ['kernel/', 'expectations/', 'lint/engine/', 'lint/index.refusal'],
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
            mobile: librariesOwnedIn('src/facets/mobile/'),
            website: librariesOwnedIn('src/facets/website/'),
        },
        imports: [
            'kernel/',
            'world/',
            'elements/',
            'expectations/',
            'lint/engine/',
            'lint/index.refusal',
        ],
        packages: ['vitest'],
        seams: {
            'facets/specification.ts': [
                'facets/api/api.handle',
                'facets/cli/cli.handle',
                'facets/integration/integration.handle',
                'facets/job/job.handle',
                'facets/mobile/mobile.handle',
                'facets/website/website.handle',
            ],
            // The project kit runs in the Vitest main process only, never in test code.
            'facets/api/api.project.ts': ['vitest/project-kit'],
            'facets/cli/cli.project.ts': ['vitest/project-kit'],
            'facets/component/component.project.ts': ['vitest/project-kit'],
            'facets/integration/integration.project.ts': ['vitest/project-kit'],
            'facets/job/job.project.ts': ['vitest/project-kit'],
            'facets/mobile/mobile.project.ts': ['vitest/project-kit'],
            'facets/website/website.project.ts': ['vitest/project-kit'],
        },
    },
    vitest: {
        imports: [
            'vitest/',
            'kernel/',
            'facets/api/api.project',
            'facets/cli/cli.project',
            'facets/component/component.project',
            'facets/integration/integration.project',
            'facets/job/job.project',
            'facets/mobile/mobile.project',
            'facets/website/website.project',
            // Update mode's global setup, which every project carries.
            'expectations/in-place/in-place-setup',
            'lint/engine/',
        ],
        packages: ['vitest'],
    },
    lint: {
        imports: ['lint/'],
        // oxlint's plugin types and the toolchain's config type (erased), its config names (inlined), and the module parser.
        packages: [
            '@oxlint/plugins',
            '@jterrazz/typescript/config',
            '@jterrazz/typescript/oxlint',
            '@jterrazz/typescript/oxlint-config-names',
            ...librariesOwnedIn('lint/'),
        ],
        seams: { 'lint/self/corpus/compositions.ts': ['facets/', 'kernel/chain/define-facet'] },
    },
} satisfies Record<string, LayerOptions>;
