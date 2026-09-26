import type { LayerOptions } from '../../consumer/rules/architecture/import-within-declared-layers.js';
import { enginesOwnedIn } from './engines.js';

/** This package's layer map (`import-within-declared-layers`), which `oxlint.config.ts` hands the rule: `kernel ← world · elements · expectations ← facets ← vitest · the entries`. What a map cannot express is the self checker's, `SELF_PASS_IDS` in `checker.ts`; engine ownership is read off `ENGINE_OWNERS`. */
export const FRAMEWORK_LAYERS = {
    kernel: {
        folders: {
            chain: [],
            // The config file's own types are the toolchain's.
            config: ['@jterrazz/typescript/config'],
            context: [],
            // A scratch folder ends with the test that asked for it (vitest's `onTestFinished`).
            files: ['vitest'],
            refusals: [],
            yaml: enginesOwnedIn('src/kernel/yaml/'),
        },
        imports: ['kernel/'],
    },
    world: {
        folders: {
            clock: ['vitest'],
            mocks: ['vitest', ...enginesOwnedIn('src/world/mocks/')],
            // The container server's reader is a provided value (`vitest`).
            services: [...enginesOwnedIn('src/world/services/'), 'vitest'],
            stubs: enginesOwnedIn('src/world/stubs/'),
        },
        imports: ['kernel/'],
        seams: {
            // A stub's request filter is an expectation on the outgoing request: one grammar, never a second.
            'world/stubs/exchange/queue.ts': ['expectations/tokens/'],
            'world/stubs/filters.ts': ['expectations/tokens/'],
            'world/stubs/http/http.ts': ['expectations/tokens/'],
        },
    },
    elements: { imports: ['kernel/', 'elements/'] },
    expectations: { imports: ['kernel/', 'expectations/'], packages: ['vitest'] },
    // A folder owns its files, and no facet lists another.
    facets: {
        folders: {
            api: enginesOwnedIn('src/facets/api/'),
            cli: enginesOwnedIn('src/facets/cli/'),
            component: enginesOwnedIn('src/facets/component/'),
            integration: enginesOwnedIn('src/facets/integration/'),
            job: enginesOwnedIn('src/facets/job/'),
            mobile: enginesOwnedIn('src/facets/mobile/'),
            website: enginesOwnedIn('src/facets/website/'),
        },
        imports: ['kernel/', 'world/', 'elements/', 'expectations/'],
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
        ],
        packages: ['vitest'],
    },
    lint: {
        imports: [
            'lint/',
            // One answer to where a tool writes what it generates.
            'kernel/files/artifacts',
            // The four ground names have one home: a rule probing its own copy could drift from what the runner resolves.
            'kernel/files/ground',
            // `no-redundant-root`'s rule must derive the root with the framework's own walk, not a copy.
            'kernel/files/resolve',
            // The path law the runner refuses by is the one the rules read by.
            'kernel/files/spec-path',
            // Every gate judges the tree the runtime reads: what git does not ignore.
            'kernel/files/git-tree',
            'kernel/yaml/document',
            // The checker loads the file synchronously, since every pass is sync, and reads it with the runtime's reader.
            'kernel/config/settings',
            'kernel/config/test-section',
            // A finding and a refusal teach in one form: the four parts, and how they read.
            'kernel/refusals/lesson',
            // The runtime's refusals open on the sentence their catalogue row does.
            'kernel/refusals/refusal',
            'expectations/tokens/match',
            // `ground-shared-or-inline`'s fixer proves its guess against the runtime's own dedent.
            'expectations/text/dedent',
            'world/services/record-key',
            // The folders a stub may sit in are the builders the package exports, listed once.
            'world/stubs/kinds',
            // The route-coverage key and the `.spec.yaml` grammar are read by the runner and the checker alike: one owner each.
            'facets/api/routes/baseline',
            'facets/cli/documents/spec-document',
        ],
        // oxlint's plugin types and the toolchain's config type (erased), its config names (inlined), and the module parser.
        packages: [
            '@oxlint/plugins',
            '@jterrazz/typescript/oxlint',
            '@jterrazz/typescript/oxlint-config-names',
            ...enginesOwnedIn('lint/'),
        ],
        seams: { 'lint/self/corpus/compositions.ts': ['facets/', 'kernel/chain/define-facet'] },
    },
} satisfies Record<string, LayerOptions>;
