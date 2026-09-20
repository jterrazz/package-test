import { compose, defineConfig, library } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

// Self-lint with our own plugin (the tool-facing lint layer under src/lint/),
// Loaded from the built bundle. Node's TS type-stripping does not resolve
// `.js` specifiers to `.ts` sources, so `npm run build` must precede lint.
import { testing } from './dist/oxlint.js';

/**
 * The five trees of this package and their sanctioned edges (CONVENTIONS I1).
 *
 * - `core/` — the chain, the results, the elements (the descriptors, and the
 *   ambiguity and substring readings every surface shares), the contracts and
 *   the intercept, the goldens, the clock and the doubles: what every facet is
 *   made of. It reaches the three seams that carry no engine of their own
 *   (docker, process, yaml), the msw engine through the one lazy import each
 *   of its two openers owns, and — to CONSTRUCT what a terminal action hands
 *   back — the facet module that declares that result.
 * - `facets/<facet>/` — the same four files in every folder
 *   (`<facet>.specification.ts`, `.chain.ts`, `.result.ts`, `.project.ts`)
 *   plus what is unique to the facet. It reaches `core/` freely, and each
 *   constructor opens the one seam its runtime needs.
 * - `seams/<dep>/` — one folder = one external dependency (or one node
 *   builtin, as `process/` is), plus `core/` and the facet vocabulary an
 *   adapter projects into (the device's ambiguity reading, the cli result a
 *   container exec produces).
 * - `runner/` — the config surface: the preset, the project index, update
 *   mode, the literate plugin. It couples to `vite`/`vitest` by design.
 * - `lint/` — zero runtime imports: no external packages, and from `core/`
 *   only the pure helpers (the token list, the case conversions, fixture
 *   markers, the root walk a rule must share with the runner, the
 *   spec-document parser).
 *
 * `src/index.ts`, `src/surface.ts` and `src/browser/` are composition roots and
 * name no layer, so they are out of scope; module tests and `*.fixtures.ts`
 * files are governed by F2/I4.
 */
const FRAMEWORK_LAYERS = {
    core: {
        imports: [
            'core/',
            // A terminal action CONSTRUCTS the facet's result — `new
            // HttpResult(…)`, `new PageResult(…)` — and the facet folder is
            // where that class lives (`<facet>.result.ts`). It is a value
            // edge, by design: one builder, seven results it names.
            'facets/api/api.result',
            'facets/cli/cli.result',
            'facets/cli/literate',
            'facets/integration/integration.result',
            'facets/mobile/mobile.result',
            'facets/website/website.result',
            // The three seams that carry no engine of their own: a docker
            // Lookup is a shell read, a yaml document is a parse, a process is
            // `node:child_process`.
            'seams/docker/',
            'seams/process/',
            'seams/yaml/document',
            // Update-mode detection is a pure env read the literate runner
            // Shares with the matchers — one answer to "are we rewriting?".
            'runner/update',
        ],
        packages: ['vitest', 'vitest-mock-extended'],
        seams: {
            // The contract engine is reached through a lazy import, once per
            // Opener: the chain's `.intercept()` and the module-scope one.
            'core/chain/builder.ts': ['seams/msw/'],
            'core/contracts/intercept.ts': ['seams/msw/'],
        },
    },
    facets: {
        imports: ['facets/', 'core/', 'runner/facet-project', 'runner/preset', 'runner/update'],
        packages: ['vite', 'vitest', 'vitest/config', '@vitest/browser-playwright'],
        seams: {
            'facets/api/api.specification.ts': ['seams/docker/', 'seams/hono/'],
            'facets/cli/cli.result.ts': ['seams/docker/'],
            'facets/cli/cli.specification.ts': ['seams/docker/'],
            // The component model reaches its two seams and never the runner:
            // "after this test", "pin the clock" and "what did the project
            // Provide" are asked of `seams/vitest-browser/`, which owns the
            // `vitest` import the way `src/runner/` owns the config side.
            'facets/component/component.chain.ts': ['seams/msw/', 'seams/vitest-browser/'],
            'facets/component/component.types.ts': ['seams/vitest-browser/'],
            'facets/component/component.project.ts': ['seams/vitest-browser/commands'],
            'facets/cli/cli.project.ts': ['runner/literate-plugin'],
            'facets/cli/literate.ts': ['seams/process/'],
            'facets/mobile/appium-server.ts': ['seams/process/'],
            'facets/mobile/mobile.specification.ts': ['seams/appium/'],
            'facets/website/website.specification.ts': ['seams/playwright/', 'seams/process/'],
        },
    },
    lint: {
        imports: [
            'lint/',
            // The coverage ratchet reads the report the preset asked for, and
            // There is ONE answer to where a tool writes what it generates.
            'core/artifacts/artifacts',
            // The .spec.yaml grammar is read by the runner AND by the checker —
            // One parser, so the file lint accepts is the one the runner runs.
            'core/literate/spec-document',
            'seams/yaml/document',
            'core/matching/match',
            'core/chain/binding',
            'core/chain/fixtures',
            // The four ground names have ONE home; a rule that probed for its
            // Own copy of them could drift from what the runner resolves.
            'core/chain/ground',
            // A9's rule must derive the root with the framework's own walk, not a copy.
            'core/chain/resolve',
        ],
    },
    runner: {
        imports: [
            'runner/',
            'core/',
            // The cli project wires the literate door, and the plugin needs the
            // Facet's own runner to bind a document to.
            'facets/cli/literate',
            'facets/',
        ],
        packages: ['vite', 'vitest', 'vitest-mock-extended', '@vitest/browser-playwright'],
    },
    seams: {
        folders: {
            anthropic: ['@anthropic-ai/sdk'],
            appium: ['webdriverio'],
            docker: [],
            hono: ['hono', '@hono/node-server'],
            msw: ['msw'],
            openai: ['openai'],
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
            'core/',
            // The one module every seam folder reaches for: it owns the
            // Message a MISSING optional peer produces, and a copy of that
            // Message per folder is how the four of them would have drifted.
            'seams/peer',
            // What an adapter PROJECTS into: the device's own reading of an
            // Ambiguity and the result a container exec produces are the
            // Facet's vocabulary, and a seam that copied them would answer in
            // A second dialect. The SHARED readings are `core/elements/`.
            'facets/cli/cli.result',
            'facets/mobile/ambiguity',
            'facets/mobile/projection',
        ],
    },
};

/**
 * The published `testing` fragment wires the plugin by its package name; this
 * repository is that package, and lints itself from the bundle it just built.
 */
const selfTesting = { ...testing, jsPlugins: ['./dist/oxlint.js'] };

const config: OxlintConfig = defineConfig(
    compose(library, selfTesting, {
        overrides: [
            {
                // The framework's own module tests unit-test the constructors —
                // Creating a runner outside a *.specification.ts file is their
                // Purpose.
                files: ['src/**/*.test.ts'],
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
                    'src/core/clock/**',
                    'src/core/doubles/**',
                    'src/core/goldens/**',
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
