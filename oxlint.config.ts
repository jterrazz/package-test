import { compose, defineConfig, node } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

// Self-lint with our own plugin (the tool-facing lint layer at the root, lint/),
// Loaded from the built bundle. Node's TS type-stripping does not resolve
// `.js` specifiers to `.ts` sources, so `npm run build` must precede lint.
import { testing } from './dist/oxlint.js';
import { FRAMEWORK_LAYERS, selfRules } from './dist/self-oxlint.js';

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
                    'src/seams/vitest/**',
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
            // THIS package's architecture (CONVENTIONS I1), stated beside the
            // Self rules (`lint/self-layers.ts`) and wired where the package
            // Configures itself. The rule ships inert: an architecture is the
            // Project's to declare, not the linter's to assume.
            'jterrazz/i1-layer-boundaries': ['error', { layers: FRAMEWORK_LAYERS }],
        },
    }),
);

export default config;
