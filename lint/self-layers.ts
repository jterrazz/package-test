import type { LayerOptions } from './rules/model/i1-layer-boundaries.js';

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
 *   four-part refusal (`refusals/`) and the `test` section of the config
 *   (`config/`). It imports nothing else from `src/`.
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
 * owner — is held by the self rules of `lint/self/`.
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
            // `onTestFinished`); the yaml document is the one yaml engine.
            files: ['vitest', 'yaml'],
            refusals: [],
        },
        imports: ['kernel/'],
        // PENDING the restructure's follow-ups: each edge below leaves with
        // The commit that moves its type to its owner.
        seams: {
            'kernel/chain/action-signatures.ts': ['facets/', 'elements/', 'expectations/'],
            'kernel/chain/config.ts': ['world/', 'elements/', 'facets/'],
            'kernel/chain/setup-signatures.ts': ['world/', 'facets/'],
            'kernel/context/with.capability.ts': ['facets/cli/process/cli.port'],
        },
    },
    // What surrounds the subject, controlled by the test: the kernel only, each
    // Area its engine.
    world: {
        folders: {
            clock: ['vitest'],
            mocks: ['vitest', 'vitest-mock-extended'],
            // The container server's reader is a provided value (`vitest`).
            services: ['better-sqlite3', 'pg', 'redis', 'testcontainers', 'vitest'],
            stubs: ['msw'],
        },
        imports: ['kernel/'],
        seams: {
            // A stub's request filter IS an expectation on the outgoing
            // Request: one `match.*` / `{{token}}` grammar, never a second.
            'world/stubs/exchange/queue.ts': ['expectations/tokens/'],
            'world/stubs/filters.ts': ['expectations/tokens/'],
            'world/stubs/http/http.ts': ['expectations/tokens/'],
        },
    },
    // How a screen is designated and touched — shared by website, component, mobile.
    elements: { imports: ['kernel/', 'elements/'] },
    // How a result is judged.
    expectations: {
        imports: ['kernel/', 'expectations/'],
        packages: ['vitest'],
        // PENDING the restructure's follow-ups: each edge below leaves with
        // The commit that moves its type to its owner.
        seams: {
            'expectations/command/cli.result.ts': ['facets/cli/process/cli.port'],
            'expectations/command/container.ts': ['facets/cli/process/cli.port'],
            'expectations/goldens/matchers.ts': ['world/services/startup/startup-report'],
            'expectations/goldens/text-assertions.ts': ['world/services/startup/startup-report'],
            'expectations/http/response.ts': ['facets/api/server/server.port'],
            'expectations/result.ts': ['world/services/database.port'],
            'expectations/table/table.ts': ['world/services/database.port'],
        },
    },
    // What is tested: one slice per constructor. A folder owns its files, and
    // No facet lists another (`facets/` is absent from `imports`).
    facets: {
        folders: {
            api: ['hono', '@hono/node-server'],
            cli: [],
            component: ['@vitest/browser-playwright', 'react', 'vite', 'vitest-browser-react'],
            integration: [],
            job: [],
            mobile: ['webdriverio'],
            website: ['playwright'],
        },
        imports: ['kernel/', 'world/', 'elements/', 'expectations/'],
        // Projects (`vitest/config`), the provided readers and the global
        // Setups (`vitest`, `vitest/node`).
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
            // A facet's project is built on the preset's project kit; both run in
            // The Vitest main process only, never in test code.
            'facets/api/api.project.ts': ['vitest/facet-project', 'vitest/preset'],
            'facets/cli/cli.project.ts': ['vitest/facet-project', 'vitest/preset'],
            'facets/component/component.project.ts': ['vitest/facet-project', 'vitest/preset'],
            'facets/integration/integration.project.ts': ['vitest/facet-project', 'vitest/preset'],
            'facets/job/job.project.ts': ['vitest/facet-project', 'vitest/preset'],
            'facets/mobile/mobile.project.ts': ['vitest/facet-project', 'vitest/preset'],
            'facets/website/website.project.ts': ['vitest/facet-project', 'vitest/preset'],
            // PENDING the restructure's follow-ups: the provided readers move
            // Beside their providers, the component's options beside its project.
            'facets/api/api.handle.ts': ['vitest/provided'],
            'facets/mobile/mobile.handle.ts': ['vitest/provided'],
            'facets/component/component.facet.ts': ['vitest/facet-project'],
        },
    },
    // @jterrazz/test/vitest — preset, projects, run lifecycle: assembles the facets' projects.
    vitest: {
        imports: [
            'vitest/',
            'kernel/',
            'expectations/',
            'world/',
            'facets/api/api.project',
            'facets/cli/cli.project',
            'facets/component/component.project',
            'facets/integration/integration.project',
            'facets/job/job.project',
            'facets/mobile/mobile.project',
            'facets/website/website.project',
            // The literate door: the one vite plugin a facet owns.
            'facets/cli/documents/literate-plugin',
        ],
        packages: ['@vitest/browser-playwright', 'vite', 'vitest'],
        // PENDING the restructure's follow-ups: the provided readers move beside their providers.
        seams: { 'vitest/provided.ts': ['facets/mobile/session/appium-server'] },
    },
    lint: {
        imports: [
            'lint/',
            // The coverage ratchet reads the report the preset asked for, and
            // There is ONE answer to where a tool writes what it generates.
            'kernel/files/artifacts',
            // The four ground names have ONE home; a rule that probed for its
            // Own copy of them could drift from what the runner resolves.
            'kernel/files/ground',
            // A9's rule must derive the root with the framework's own walk, not a copy.
            'kernel/files/resolve',
            // The path law the runner refuses by is the one the rules read by.
            'kernel/files/spec-path',
            // Every gate judges the tree the runtime reads: what git does not ignore.
            'kernel/files/git-tree',
            'kernel/files/yaml-document',
            // A finding and a refusal teach in one form: the four parts, and how they read.
            'kernel/refusals/lesson',
            // The runtime's refusals open on the sentence their catalogue row does.
            'kernel/refusals/refusal',
            'expectations/tokens/match',
            // C28's fixer writes a value in place; the runtime's own dedent is
            // What reads it back, so the fixer proves its guess against it.
            'expectations/text/dedent',
            'world/services/startup/binding',
            // The folders a stub may sit in are the builders the package exports, listed once.
            'world/stubs/kinds',
            // The run owns one key of the ratchet the checker writes (route
            // Coverage), and the .spec.yaml grammar is read by the runner AND
            // The checker: one owner each, reached where it lives.
            'facets/api/routes/routes',
            'facets/cli/documents/spec-document',
        ],
        // oxlint's plugin types (erased), the toolchain's config names
        // (inlined), and the module parser a rule walks past a module with.
        packages: ['@oxlint/plugins', '@jterrazz/typescript/oxlint-config-names', 'oxc-parser'],
        seams: { 'lint/self/compositions.ts': ['facets/', 'kernel/chain/define-facet'] },
    },
} satisfies Record<string, LayerOptions>;
