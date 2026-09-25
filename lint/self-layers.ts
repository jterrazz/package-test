import type { LayerOptions } from './rules/model/i1-layer-boundaries.js';

/**
 * The trees of this package and their sanctioned edges (CONVENTIONS I1) — the
 * layer map `oxlint.config.ts` hands `i1-layer-boundaries`, which ships inert.
 * A self module: bundled into `dist/self-oxlint.js` beside the self rules, and
 * never into what a consumer installs.
 *
 * - `model/` — the chain, the elements (the descriptors, and the ambiguity
 *   and substring readings every surface shares), the goldens, the clock and
 *   the doubles: what every facet is made of. It reaches the seams that
 *   carry no engine of their own (git, process, yaml) and — to compare a
 *   golden through its accessor — `results/`. A constructor's configuration
 *   names the stub backend a website or mobile constructor started.
 * - `capabilities/<name>/` — a setup a chain offers, one folder each, owning
 *   only itself (`signatures.ts` indexes them all); among them the
 *   module-scope `intercept()`, which names its engine's registration, and
 *   the route a request names with its `params`.
 * - `actions/<name>/` — a terminal action, one folder each (`signatures.ts`
 *   indexes them all); among them `run/`, the document engine, which starts
 *   servers and lays fixtures through the process and filesystem seams.
 * - `stubs/` — the stub, its exchange, the queue that serves it, and the
 *   user-facing builders, one folder per kind (`http/`, `openai/`,
 *   `anthropic/`).
 * - `results/` — what a terminal action hands back: one `<kind>.result.ts`
 *   per result, and the accessors they compose.
 * - `facets/<facet>/` — the constructor (`<facet>.handle.ts`) and the
 *   composition (`<facet>.facet.ts`) its chain is computed from, plus what
 *   is unique to the facet. It reaches `model/`,
 *   `stubs/`, `results/`, `capabilities/` and `actions/` freely; each
 *   constructor opens the seams its runtime needs, and each composition the
 *   adapters its engines are.
 * - `seams/<dep>/` — one folder = one external dependency (or one node
 *   builtin, as `process/` is), plus `model/` and the text accessor a page's
 *   golden answers through. The Appium server a runner spawns boots its
 *   simulator through `simctl/` and runs as a `process/`.
 * - `runner/` — the config surface: the preset, the project index and each
 *   facet's project (`projects/<facet>.project.ts`), update mode, the
 *   literate plugin. It couples to `vite`/`vitest` by design; the run's
 *   mobile session may reach the Appium seam.
 * - `lint/` — no external package of its own but oxlint's plugin types
 *   (`@oxlint/plugins`, erased from the bundle) and the toolchain's list of
 *   oxlint config names (inlined into the bundle): from `model/` only the pure
 *   helpers (the token list, the case conversions, fixture markers, the root
 *   walk a rule must share with the runner, the spec-document parser, the
 *   indentation a value written in place shares with the test around it),
 *   and a dependency only through the seam that owns it (the yaml document,
 *   the git tree, the module parser) — and the facets, from the one self
 *   module the capability matrix reads their compositions through.
 *
 * `src/index.ts`, `src/surface.ts` and `src/browser/` are composition roots and
 * name no layer, so they are out of scope; module tests and `*.fixtures.ts`
 * files are governed by F2/I4.
 */
export const FRAMEWORK_LAYERS = {
    // A terminal action a chain ends on, one folder per action. The index of
    // Their signatures names every one of them. A document run starts the
    // Servers it names and lays its fixtures through the process and
    // Filesystem seams; the types a render scenario is handed, and the
    // Surface the page port mounts, are the page seam's.
    actions: {
        folders: {
            call: [],
            exec: [],
            fetch: [],
            open: [],
            render: [],
            request: [],
            run: [],
            trigger: [],
            visit: [],
        },
        imports: ['model/', 'results/', 'capabilities/', 'stubs/', 'runner/update'],
        seams: {
            'actions/render/page.port.ts': ['seams/vitest-browser/'],
            'actions/render/scenario.ts': ['seams/vitest-browser/'],
            'actions/run/literate.ts': ['seams/fs/', 'seams/process/'],
            'actions/signatures.ts': ['actions/'],
        },
    },
    // A setup a chain offers, one folder per capability, each owning only
    // Itself; the index of their signatures names every one of them. The
    // Module-scope `intercept()` names the msw registration it hands its
    // Engine, a type the seam declares, and `.wrap()` the page seam's UI type.
    capabilities: {
        folders: {
            clock: [],
            env: [],
            fixture: [],
            headers: [],
            intercept: [],
            params: [],
            seed: [],
            viewport: [],
            with: [],
            wrap: [],
        },
        imports: ['model/', 'stubs/'],
        seams: {
            'capabilities/intercept/intercept.scope.ts': ['seams/msw/'],
            'capabilities/signatures.ts': ['capabilities/'],
            'capabilities/wrap/wrap.capability.ts': ['seams/vitest-browser/ui'],
        },
    },
    facets: {
        imports: [
            'actions/',
            'capabilities/',
            'facets/',
            'model/',
            'results/',
            'stubs/',
            'runner/facet-project',
            'runner/provided',
        ],
        seams: {
            // A facet's composition names the adapters its engines are.
            'facets/api/api.facet.ts': ['seams/msw/', 'seams/vitest/', 'seams/fs/'],
            'facets/cli/cli.facet.ts': ['seams/fs/', 'seams/process/'],
            // The component's constructor is its project: the composition
            // States a matrix row per option the project takes.
            'facets/component/component.facet.ts': [
                'runner/projects/component.project',
                'seams/msw/',
                'seams/vitest-browser/',
            ],
            'facets/integration/integration.facet.ts': ['seams/msw/', 'seams/vitest/', 'seams/fs/'],
            'facets/jobs/jobs.facet.ts': ['seams/msw/', 'seams/vitest/', 'seams/fs/'],
            'facets/mobile/mobile.facet.ts': ['seams/stub-backend/', 'seams/appium/'],
            'facets/website/website.facet.ts': ['seams/stub-backend/', 'seams/playwright/'],
            'facets/api/api.handle.ts': ['seams/hono/'],
            'facets/cli/cli.handle.ts': ['seams/process/'],
            'facets/mobile/mobile.handle.ts': [
                'seams/appium/',
                'seams/simctl/',
                'seams/stub-backend/',
            ],
            'facets/website/website.handle.ts': [
                'seams/playwright/',
                'seams/process/',
                'seams/stub-backend/',
            ],
        },
    },
    lint: {
        imports: [
            'lint/',
            // The coverage ratchet reads the report the preset asked for, and
            // There is ONE answer to where a tool writes what it generates.
            'model/artifacts/artifacts',
            // The .spec.yaml grammar is read by the runner AND by the checker —
            // One parser, so the file lint accepts is the one the runner runs.
            'model/literate/spec-document',
            'seams/yaml/document',
            'model/matching/match',
            // C28's fixer writes a value in place; the runtime's own
            // dedent is what reads it back, so the fixer proves its guess
            // against it rather than reimplementing the indentation rule.
            'model/matching/dedent',
            'model/services/binding',
            // The path law the runner refuses by is the one the rules read by.
            'model/chain/spec-path',
            // The four ground names have ONE home; a rule that probed for its
            // Own copy of them could drift from what the runner resolves.
            'model/chain/ground',
            // A9's rule must derive the root with the framework's own walk, not a copy.
            'model/chain/resolve',
            // A module a rule walks past is parsed into the tree oxlint hands the rule.
            'seams/oxc-parser/parse',
            // Every gate judges the tree the runtime reads: what git does not ignore.
            'seams/git/tree',
            // A finding and a refusal teach in one form: the four parts, and how they read.
            'model/lesson/lesson',
            // The runtime's refusals open on the sentence their catalogue row does.
            'model/lesson/refusal',
            // The run owns one key of the ratchet the checker writes: route coverage.
            'model/routes/routes',
        ],
        // oxlint's plugin types (erased) and the toolchain's config names
        // (inlined), so the checker and `check` find the same config.
        packages: ['@oxlint/plugins', '@jterrazz/typescript/oxlint-config-names'],
        seams: { 'lint/self/compositions.ts': ['facets/'] },
    },
    model: {
        imports: [
            'model/',
            // A golden is compared through the accessor it is handed: the
            // Matchers reach `results/`, a value edge by design.
            'results/',
            // The three seams that carry no engine of their own: the tree git
            // Does not ignore is one `git ls-files`, a yaml document is a
            // Parse, a process is `node:child_process`.
            'seams/git/',
            'seams/process/',
            'seams/yaml/document',
            // Update-mode detection is a pure env read the literate runner
            // Shares with the matchers — one answer to "are we rewriting?".
            'runner/update',
        ],
        packages: ['vitest', 'vitest-mock-extended'],
        seams: {
            // What a constructor hands its chain names the stub backend a
            // Website or mobile constructor started.
            'model/chain/config.ts': ['seams/stub-backend/'],
        },
    },
    // What a terminal action hands back: the result classes and the accessors
    // they compose, over the model's bricks. A container's accessor and the
    // cli result read `docker` through the seam that carries no engine.
    results: {
        imports: ['model/', 'results/'],
        seams: {
            'results/cli.result.ts': ['seams/docker/'],
            'results/container.ts': ['seams/docker/'],
        },
    },
    // The user-facing stub builders — `http`, `openai`, `anthropic`, one folder
    // per kind — over the stub, its exchange and the queue that serves it.
    stubs: { imports: ['model/', 'stubs/'] },
    runner: {
        imports: ['runner/', 'model/'],
        packages: ['vite', 'vitest', '@vitest/browser-playwright'],
        // The component project serves the page's golden commands; the run's
        // Mobile session, what it provides and the device a mobile project
        // Declares reach the Appium seam.
        seams: {
            'runner/mobile-session.ts': ['seams/appium/'],
            'runner/projects/component.project.ts': ['seams/vitest-browser/commands'],
            'runner/projects/mobile.project.ts': ['seams/appium/'],
            'runner/provided.ts': ['seams/appium/'],
        },
    },
    seams: {
        folders: {
            appium: ['webdriverio'],
            docker: [],
            fs: [],
            git: [],
            hono: ['hono', '@hono/node-server'],
            msw: ['msw'],
            'oxc-parser': ['oxc-parser'],
            playwright: ['playwright'],
            postgres: ['pg'],
            process: [],
            redis: ['redis'],
            simctl: [],
            sqlite: ['better-sqlite3'],
            'stub-backend': [],
            testcontainers: ['testcontainers'],
            vitest: ['vitest'],
            'vitest-browser': ['react', 'vitest', 'vitest-browser-react'],
            yaml: ['yaml'],
        },
        imports: [
            'model/',
            // The one module every seam folder reaches for: it owns the
            // Message a MISSING optional peer produces, and a copy of that
            // Message per folder is how the four of them would have drifted.
            'seams/peer',
            // The engines serve the stubs a chain declares.
            'stubs/',
            // The page's golden commands answer through the text accessor
            // every stream is compared by, one `TextAccessor` for both builds.
            'results/text',
        ],
        // The Appium server a runner spawns boots its simulator and runs as a process.
        seams: { 'seams/appium/appium-server.ts': ['seams/process/', 'seams/simctl/'] },
    },
} satisfies Record<string, LayerOptions>;
