import { compose, defineConfig, library } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

// Self-lint with our own plugin (the tool-facing lint layer under src/lint/),
// Loaded from the built bundle. Node's TS type-stripping does not resolve
// `.js` specifiers to `.ts` sources, so `npm run build` must precede lint.
import { testing } from './dist/oxlint.js';

/**
 * The four layers of this package and their sanctioned edges (CONVENTIONS I1).
 *
 * - `specification/` — zero external imports; may reach `integrations/docker`,
 *   `integrations/hono`, `vitest/matchers`, plus three lazy seams, each opened
 *   for the one module that owns it.
 * - `integrations/<dep>/` — one folder = one external dependency, plus `specification/`.
 * - `vitest/` — the runner coupling: `vitest`, `vitest-mock-extended`,
 *   plus `specification/` and `integrations/docker` (the matchers recognise
 *   the zero-dependency ContainerAccessor subject).
 * - `lint/` — zero runtime imports: no external packages, and from `specification/` only
 *   the pure helpers (the token list, the case conversions, fixture markers, the
 *   root walk a rule must share with the runner, the spec-document parser).
 *
 * `src/index.ts` is the composition root and names no layer, so it is out of
 * scope; module tests and `*.fixtures.ts` files are governed by F2/I4.
 */
const FRAMEWORK_LAYERS = {
    specification: {
        imports: [
            'specification/',
            'integrations/docker/',
            'integrations/hono/',
            'integrations/yaml/',
            'vitest/matchers',
            // The one time primitive: a chain's `.clock()` pins the calendar
            // Through the same seam a test takes it through by hand.
            'vitest/clock',
            // Update-mode detection is a pure env read the literate runner
            // Shares with the matchers — one answer to "are we rewriting?".
            'vitest/update',
        ],
        seams: {
            // The component model reaches its two seams and never the runner:
            // "after this test", "pin the clock" and "what did the project
            // Provide" are asked of `integrations/vitest-browser/`, which owns
            // The `vitest` import the way `src/vitest/` owns the config side.
            'specification/facets/component/component.chain.ts': [
                'integrations/msw/',
                'integrations/vitest-browser/',
            ],
            'specification/facets/component/component.types.ts': ['integrations/vitest-browser/'],
            'specification/facets/mobile/start-mobile.ts': ['integrations/appium/'],
            'specification/facets/_common/builder.ts': ['integrations/msw/'],
            'specification/facets/website/start-website.ts': ['integrations/playwright/'],
        },
    },
    integrations: {
        folders: {
            anthropic: ['@anthropic-ai/sdk'],
            appium: ['webdriverio'],
            compose: ['yaml'],
            docker: [],
            hono: ['hono', '@hono/node-server'],
            msw: ['msw'],
            openai: ['openai'],
            playwright: ['playwright'],
            postgres: ['pg'],
            redis: ['redis'],
            sqlite: ['better-sqlite3'],
            testcontainers: ['testcontainers'],
            'vitest-browser': ['react', 'vitest', 'vitest-browser-react'],
            yaml: ['yaml'],
        },
        imports: ['specification/'],
    },
    lint: {
        imports: [
            'lint/',
            // The .spec.yaml grammar is read by the runner AND by the checker —
            // One parser, so the file lint accepts is the one the runner runs.
            'specification/literate/spec-document',
            'integrations/yaml/document',
            'specification/matching/match',
            'specification/facets/_common/binding',
            'specification/facets/_common/fixtures',
            // The four ground names have ONE home; a rule that probed for its
            // Own copy of them could drift from what the runner resolves.
            'specification/facets/_common/ground',
            // A9's rule must derive the root with the framework's own walk, not a copy.
            'specification/facets/_common/resolve',
        ],
    },
    vitest: {
        imports: [
            'specification/',
            'vitest/',
            'integrations/docker/',
            // The component project registers the seam's server-side commands:
            // The golden pair and the ARIA producer are Browser Mode's, not the
            // Model's, so they live with the adapter that reads them.
            'integrations/vitest-browser/commands',
        ],
        packages: ['vite', 'vitest', 'vitest-mock-extended', '@vitest/browser-playwright'],
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
                files: ['src/vitest/**', 'src/integrations/vitest-browser/**'],
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
