import type { LayerOptions } from './rules/model/i1-layer-boundaries.js';
import { enginesOwnedIn } from './self-engines.js';

/**
 * The trees of this package and their sanctioned edges (CONVENTIONS I1) — the
 * layer map `oxlint.config.ts` hands `i1-layer-boundaries`, which ships inert.
 * A self module: bundled into `dist/self-oxlint.js` beside the self rules, and
 * never into what a consumer installs.
 *
 * The root reads the sentence of a test, and the edges point one way:
 * `kernel ← world · elements · expectations ← facets ← vitest · the entries`.
 *
 * - `kernel/` — the machinery that builds a facet and knows none: the chain
 *   (`defineFacet`, the setup and action contracts, the computed chain type),
 *   what a file shares (`context/`), the disk a spec names (`files/`), the
 *   four-part refusal (`refusals/`), the `test` section of the config
 *   (`config/`), the one yaml engine (`yaml/`), and at its root the one timed
 *   wait (`pause.ts`) and the `database` option's check (`database-option.ts`).
 *   It imports nothing else from `src/`.
 * - `world/` — what surrounds the subject, controlled by the test: the network
 *   outside (`stubs/`), the real databases and their containers (`services/`),
 *   time (`clock/`) and the in-memory collaborators of a module test
 *   (`mocks/`). Each area owns its engine.
 * - `elements/` — how a screen is designated and touched, shared by website,
 *   mobile and component.
 * - `expectations/` — how a result is judged: `toMatch`, goldens, tokens,
 *   update mode, the accessors.
 * - `facets/<facet>/` — what is tested, one slice per constructor: its
 *   composition, its handle, its Vitest project, and its concept folders. A
 *   facet never imports another.
 * - `vitest/` — `@jterrazz/test/vitest`: the preset, the projects index and
 *   the run lifecycle, assembling each facet's project.
 * - `lint/` — the rules the package ships, at the root: from `src/` only the
 *   pure helpers a rule must share with the runtime.
 *
 * `src/index.ts` and `src/index.browser.ts` are composition roots and name no
 * layer, so they are out of scope; module tests and `*.fixtures.ts` files are
 * governed by F2/I4. What this map cannot express — a facet reaching another,
 * a concept folder reached from outside its facet, an engine outside its one
 * owner, a folder named for a role — is held by the self checker passes I9
 * to I12 (`lint/checker-source-tree.ts`, `lint/checker-source-imports.ts`).
 * Which engine a folder may import is not stated here but read off
 * `ENGINE_OWNERS` (`lint/self-engines.ts`), and I10 reads which modules may
 * reach into a facet off this map's `facets/` edges: each fact, one owner.
 */
export const FRAMEWORK_LAYERS = {
    // The machinery that builds a facet and knows none: imports nothing else from src/.
    kernel: {
        folders: {
            chain: [],
            // The config file's own types are the toolchain's.
            config: ['@jterrazz/typescript/config'],
            context: [],
            // A scratch folder ends with the test that asked for it (vitest's
            // `onTestFinished`).
            files: ['vitest'],
            refusals: [],
            // The yaml document is the one yaml engine.
            yaml: enginesOwnedIn('src/kernel/yaml/'),
        },
        imports: ['kernel/'],
    },
    // What surrounds the subject, controlled by the test: the kernel only, each
    // area its engine.
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
            // A stub's request filter IS an expectation on the outgoing
            // request: one `match.*` / `{{token}}` grammar, never a second.
            'world/stubs/exchange/queue.ts': ['expectations/tokens/'],
            'world/stubs/filters.ts': ['expectations/tokens/'],
            'world/stubs/http/http.ts': ['expectations/tokens/'],
        },
    },
    // How a screen is designated and touched — shared by website, component, mobile.
    elements: { imports: ['kernel/', 'elements/'] },
    // How a result is judged.
    expectations: { imports: ['kernel/', 'expectations/'], packages: ['vitest'] },
    // What is tested: one slice per constructor. A folder owns its files, and
    // no facet lists another (`facets/` is absent from `imports`).
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
        // Projects (`vitest/config`), the provided readers and the global
        // setups (`vitest`, `vitest/node`).
        packages: ['vitest'],
        seams: {
            // The facets layer's one composition: the six constructors as one record.
            'facets/specification.ts': [
                'facets/api/api.handle',
                'facets/cli/cli.handle',
                'facets/integration/integration.handle',
                'facets/job/job.handle',
                'facets/mobile/mobile.handle',
                'facets/website/website.handle',
            ],
            // A facet's project is built on the project kit, which runs in
            // the Vitest main process only, never in test code.
            'facets/api/api.project.ts': ['vitest/project-kit'],
            'facets/cli/cli.project.ts': ['vitest/project-kit'],
            'facets/component/component.project.ts': ['vitest/project-kit'],
            'facets/integration/integration.project.ts': ['vitest/project-kit'],
            'facets/job/job.project.ts': ['vitest/project-kit'],
            'facets/mobile/mobile.project.ts': ['vitest/project-kit'],
            'facets/website/website.project.ts': ['vitest/project-kit'],
        },
    },
    // @jterrazz/test/vitest — preset, projects, run lifecycle: assembles the facets' projects.
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
            // Update mode's global setup, which every project carries: its
            // owner resolves where it sits.
            'expectations/in-place/in-place-setup',
        ],
        packages: ['vitest'],
    },
    lint: {
        imports: [
            'lint/',
            // The coverage ratchet reads the report the preset asked for, and
            // there is ONE answer to where a tool writes what it generates.
            'kernel/files/artifacts',
            // The four ground names have ONE home; a rule that probed for its
            // own copy of them could drift from what the runner resolves.
            'kernel/files/ground',
            // A9's rule must derive the root with the framework's own walk, not a copy.
            'kernel/files/resolve',
            // The path law the runner refuses by is the one the rules read by.
            'kernel/files/spec-path',
            // Every gate judges the tree the runtime reads: what git does not ignore.
            'kernel/files/git-tree',
            'kernel/yaml/document',
            // The checker reads the `test` section by the runtime's own reader,
            // loading the file synchronously itself, since every pass is sync.
            'kernel/config/settings',
            'kernel/config/test-section',
            // A finding and a refusal teach in one form: the four parts, and how they read.
            'kernel/refusals/lesson',
            // The runtime's refusals open on the sentence their catalogue row does.
            'kernel/refusals/refusal',
            'expectations/tokens/match',
            // C28's fixer writes a value in place; the runtime's own dedent is
            // what reads it back, so the fixer proves its guess against it.
            'expectations/text/dedent',
            'world/services/record-key',
            // The folders a stub may sit in are the builders the package exports, listed once.
            'world/stubs/kinds',
            // The run owns one key of the ratchet the checker writes (route
            // coverage), and the .spec.yaml grammar is read by the runner AND
            // the checker: one owner each, reached where it lives.
            'facets/api/routes/baseline',
            'facets/cli/documents/spec-document',
        ],
        // oxlint's plugin types (erased), the toolchain's config names
        // (inlined), and the module parser a rule walks past a module with.
        packages: [
            '@oxlint/plugins',
            '@jterrazz/typescript/oxlint-config-names',
            ...enginesOwnedIn('lint/'),
        ],
        seams: { 'lint/self/compositions.ts': ['facets/', 'kernel/chain/define-facet'] },
    },
} satisfies Record<string, LayerOptions>;
