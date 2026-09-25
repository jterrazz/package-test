import { compose, defineConfig, node } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

// Self-lint with our own plugin (the tool-facing lint layer at the root, lint/),
// Loaded from the built bundle. Node's TS type-stripping does not resolve
// `.js` specifiers to `.ts` sources, so `npm run build` must precede lint.
import { testing } from './dist/oxlint.js';
import { selfRules } from './dist/self-oxlint.js';

/**
 * The trees of this package and their sanctioned edges (CONVENTIONS I1).
 *
 * - `model/` — the chain, the elements (the descriptors, and the ambiguity
 *   and substring readings every surface shares), the goldens, the clock and
 *   the doubles: what every facet is made of. It reaches the three seams that
 *   carry no engine of their own (docker, process, yaml), the msw engine
 *   through the chain's one lazy import, the contracts in `stubs/`, and — to
 *   CONSTRUCT what a terminal action hands back, and to compare a golden
 *   through its accessor — `results/`.
 * - `capabilities/<name>/` — a setup a chain offers, one folder each; today
 *   the module-scope `intercept()`, which names its engine's registration.
 * - `stubs/` — the contract, its exchange, the queue that serves it, and the
 *   user-facing builders, one folder per kind (`http/`, `openai/`,
 *   `anthropic/`).
 * - `results/` — what a terminal action hands back: one `<kind>.result.ts`
 *   per result, and the accessors they compose.
 * - `facets/<facet>/` — the constructor (`<facet>.handle.ts`), the chain
 *   (`.chain.ts`) and the vitest project (`.project.ts`), plus what is
 *   unique to the facet. It reaches `model/` and `results/` freely, and each
 *   constructor opens the one seam its runtime needs.
 * - `seams/<dep>/` — one folder = one external dependency (or one node
 *   builtin, as `process/` is), plus `model/`, the facet vocabulary an
 *   adapter projects into (the device's ambiguity reading), and the text
 *   accessor a page's golden answers through.
 * - `runner/` — the config surface: the preset, the project index, update
 *   mode, the literate plugin. It couples to `vite`/`vitest` by design.
 * - `lint/` — no external package of its own but oxlint's plugin types
 *   (`@oxlint/plugins`, erased from the bundle) and the toolchain's list of
 *   oxlint config names (inlined into the bundle): from `model/` only the pure
 *   helpers (the token list, the case conversions, fixture markers, the root
 *   walk a rule must share with the runner, the spec-document parser, the
 *   indentation a value written in place shares with the test around it),
 *   and a dependency only through the seam that owns it (the yaml document,
 *   the git tree, the module parser).
 *
 * `src/index.ts`, `src/surface.ts` and `src/browser/` are composition roots and
 * name no layer, so they are out of scope; module tests and `*.fixtures.ts`
 * files are governed by F2/I4.
 */
const FRAMEWORK_LAYERS = {
    // A setup a chain offers, one folder per capability, each owning only
    // Itself. The module-scope `intercept()` names the msw registration it
    // Hands its engine, a type the seam declares.
    capabilities: {
        folders: { intercept: [] },
        imports: ['model/', 'stubs/'],
        seams: { 'capabilities/intercept/intercept.scope.ts': ['seams/msw/'] },
    },
    facets: {
        imports: [
            'facets/',
            'model/',
            'results/',
            'stubs/',
            'runner/facet-project',
            'runner/preset',
            'runner/provided',
            'runner/update',
        ],
        packages: ['vite', 'vitest', 'vitest/config', '@vitest/browser-playwright'],
        seams: {
            'facets/api/api.handle.ts': ['seams/docker/', 'seams/hono/'],
            'facets/cli/cli.handle.ts': ['seams/docker/'],
            // The component model reaches its two seams and never the runner:
            // "after this test", "pin the clock" and "what did the project
            // Provide" are asked of `seams/vitest-browser/`, which owns the
            // `vitest` import the way `src/runner/` owns the config side.
            'facets/component/component.chain.ts': ['seams/msw/', 'seams/vitest-browser/'],
            'facets/component/component.shape.ts': ['seams/vitest-browser/'],
            'facets/component/component.project.ts': ['seams/vitest-browser/commands'],
            'facets/cli/literate.ts': ['seams/process/'],
            'facets/mobile/appium-server.ts': ['seams/process/'],
            'facets/mobile/mobile.handle.ts': ['seams/appium/'],
            'facets/website/website.handle.ts': ['seams/playwright/', 'seams/process/'],
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
            'model/chain/binding',
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
        // oxlint's plugin types: a type import, erased from the bundle. The
        // Config names oxlint looks for are the toolchain's list, inlined
        // Into the bundle, so the checker and `check` find the same config.
        packages: ['@oxlint/plugins', '@jterrazz/typescript/oxlint-config-names'],
    },
    model: {
        imports: [
            'model/',
            // A terminal action CONSTRUCTS its result — `new HttpResult(…)`,
            // `new PageResult(…)` — and a golden is compared through the
            // accessor it is handed: the builder and the matchers both reach
            // `results/`, a value edge by design.
            'results/',
            // The contracts a chain declares, and the queue that serves them.
            'stubs/',
            // And a document run is the cli's own engine, called by the
            // Builder's `run` the way its terminal actions are.
            'facets/cli/literate',
            // The four seams that carry no engine of their own: a docker
            // Lookup is a shell read, the tree git does not ignore is one
            // `git ls-files`, a yaml document is a parse, a process is
            // `node:child_process`.
            'seams/docker/',
            'seams/git/',
            'seams/process/',
            'seams/yaml/document',
            // Update-mode detection is a pure env read the literate runner
            // Shares with the matchers — one answer to "are we rewriting?".
            'runner/update',
        ],
        packages: ['vitest', 'vitest-mock-extended'],
        seams: {
            // The contract engine is reached through a lazy import by the
            // Chain's `.intercept()`.
            'model/chain/builder.ts': ['seams/msw/'],
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
    // per kind — over the contract, its exchange and the queue that serves it.
    stubs: { imports: ['model/', 'stubs/'] },
    runner: {
        imports: ['runner/', 'model/', 'facets/'],
        packages: ['vite', 'vitest', 'vitest-mock-extended', '@vitest/browser-playwright'],
    },
    seams: {
        folders: {
            appium: ['webdriverio'],
            docker: [],
            git: [],
            hono: ['hono', '@hono/node-server'],
            msw: ['msw'],
            'oxc-parser': ['oxc-parser'],
            playwright: ['playwright'],
            postgres: ['pg'],
            process: [],
            redis: ['redis'],
            sqlite: ['better-sqlite3'],
            testcontainers: ['testcontainers'],
            'vitest-browser': ['react', 'vitest', 'vitest-browser-react'],
            yaml: ['yaml'],
        },
        imports: [
            'model/',
            // The one module every seam folder reaches for: it owns the
            // Message a MISSING optional peer produces, and a copy of that
            // Message per folder is how the four of them would have drifted.
            'seams/peer',
            // The engines serve the contracts a chain declares.
            'stubs/',
            // The page's golden commands answer through the text accessor
            // every stream is compared by, one `TextAccessor` for both builds.
            'results/text',
            // What an adapter PROJECTS into: the device's own reading of an
            // Ambiguity is the facet's vocabulary, and a seam that copied it
            // Would answer in a second dialect. The SHARED readings are
            // `model/elements/`.
            'facets/mobile/ambiguity',
            'facets/mobile/projection',
        ],
    },
};

/**
 * The published `testing` fragment wires the plugin by its package name; this
 * repository is that package, and lints itself from the bundle it just built —
 * plus the self plugin, the rules only this package is held to, which no
 * published fragment carries (docs/03 § The package's own rules).
 */
const selfTesting = {
    ...testing,
    jsPlugins: ['./dist/oxlint.js', './dist/self-oxlint.js'],
    rules: { ...testing.rules, ...selfRules },
};

const config: OxlintConfig = defineConfig(
    compose(node, selfTesting, {
        overrides: [
            {
                // The framework's own module tests unit-test the constructors —
                // Creating a runner outside a *.specification.ts file is their
                // Purpose.
                files: ['src/**/*.test.ts', 'lint/**/*.test.ts'],
                rules: { 'jterrazz/a1-specification-file': 'off' },
            },
            {
                // The vitest layer and the browser-mode seam ARE the sanctioned
                // Runner coupling (I1) — their `vitest` imports are the
                // Framework's own seam, not prod leakage.
                files: [
                    'src/runner/**',
                    // A facet's `<facet>.project.ts` IS the runner-config side
                    // Of that facet — it states the project the kind runs in,
                    // And states nothing a spec imports.
                    'src/facets/**/*.project.ts',
                    'src/seams/vitest-browser/**',
                    // The two seams whose dependency IS a test package: the
                    // Network double's engine and the browser the website
                    // Facet drives.
                    'src/seams/msw/**',
                    'src/seams/playwright/**',
                    'src/model/clock/**',
                    // A scratch directory ends with the test that asked for it.
                    'src/model/chain/scratch.ts',
                    'src/model/doubles/**',
                    'src/model/goldens/**',
                ],
                rules: { 'jterrazz/f2-no-test-imports-in-prod': 'off' },
            },
        ],
        rules: {
            // reason: `verbatimModuleSyntax` keeps the statement of an inline
            // Type specifier — `import { type X } from 'm'` emits `import {}
            // From 'm'`, a runtime edge, where `import type` is erased whole.
            // The rulebook's default (`prefer-inline`) therefore turns every
            // Type-only import into a real one, and turned this package's
            // Builder/result type cycle into a load-order crash. The rule stays
            // ON, at the spelling the compiler erases.
            'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
            // THIS package's architecture (CONVENTIONS I1), stated where the
            // Package configures itself. The rule ships inert: an architecture is
            // The project's to declare, not the linter's to assume.
            'jterrazz/i1-layer-boundaries': ['error', { layers: FRAMEWORK_LAYERS }],
        },
    }),
);

export default config;
