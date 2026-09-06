import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

// Self-lint with our own plugin (the tool-facing lint layer under src/lint/),
// Loaded from the built bundle. Node's TS type-stripping does not resolve
// `.js` specifiers to `.ts` sources, so `npm run build` must precede lint.
import { recommendedRules } from './dist/oxlint.js';

/**
 * The four layers of this package and their sanctioned edges (CONVENTIONS I1).
 *
 * - `core/` — zero external imports; may reach `integrations/docker`,
 *   `integrations/hono`, `vitest/matchers`, plus three lazy seams, each opened
 *   for the one module that owns it.
 * - `integrations/<dep>/` — one folder = one external dependency, plus `core/`.
 * - `vitest/` — the runner coupling: `vitest`, `vitest-mock-extended`,
 *   `mockdate`, plus `core/` and `integrations/docker` (the matchers recognise
 *   the zero-dependency ContainerAccessor subject).
 * - `lint/` — zero runtime imports: no external packages, and from `core/` only
 *   the pure helpers (the token list, the case conversions, fixture markers, the
 *   root walk a rule must share with the runner, the literate `.cli` parser).
 *
 * `src/index.ts` is the composition root and names no layer, so it is out of
 * scope; module tests and `*.fixtures.ts` files are governed by F2/I4.
 */
const FRAMEWORK_LAYERS = {
    core: {
        imports: [
            'core/',
            'integrations/docker/',
            'integrations/hono/',
            'vitest/matchers',
            // Update-mode detection is a pure env read the literate runner
            // Shares with the matchers — one answer to "are we rewriting?".
            'vitest/update',
        ],
        seams: {
            'core/specification/mobile/start-mobile.ts': ['integrations/appium/'],
            'core/specification/shared/builder.ts': ['integrations/msw/'],
            'core/specification/website/start-website.ts': ['integrations/playwright/'],
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
        },
        imports: ['core/'],
    },
    lint: {
        imports: [
            'lint/',
            // The .cli grammar is read by the runner AND by the checker — one
            // Parser, so the file lint accepts is the file the runner executes.
            'core/literate/literate-file',
            'core/matching/match',
            'core/specification/shared/binding',
            'core/specification/shared/fixtures',
            // A9's rule must derive the root with the framework's own walk, not a copy.
            'core/specification/shared/resolve',
        ],
    },
    vitest: {
        imports: ['core/', 'vitest/', 'integrations/docker/'],
        packages: ['vitest', 'vitest-mock-extended', 'mockdate'],
    },
};

export default defineConfig({
    extends: [oxlint.node],
    ignorePatterns: ['specs/**/fixtures/**'],
    jsPlugins: ['./dist/oxlint.js'],
    overrides: [
        {
            // The framework's own module tests unit-test the constructors —
            // Creating runners (and exercising the mode option) outside a
            // *.specification.ts file is their purpose.
            files: ['src/**/*.test.ts'],
            rules: {
                'jterrazz/a1-specification-file': 'off',
                'jterrazz/a5-mode-with-server': 'off',
            },
        },
        {
            // The vitest layer IS the sanctioned runner coupling (I1) — its
            // `vitest` imports are the framework's own seam, not prod leakage.
            files: ['src/vitest/**'],
            rules: { 'jterrazz/f2-no-test-imports-in-prod': 'off' },
        },
    ],
    rules: {
        ...recommendedRules,
        // Docker-aware runner names used across specs (CONVENTIONS B5).
        'jterrazz/b5-await-using': ['error', { runners: ['dockerCli'] }],
        // THIS package's architecture (CONVENTIONS I1), stated where the
        // Package configures itself. The rule ships inert: an architecture is
        // The project's to declare, not the linter's to assume.
        'jterrazz/i1-layer-boundaries': ['error', { layers: FRAMEWORK_LAYERS }],
    },
});
