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
                // The vitest layer and the modules whose engine IS a test
                // Package are the sanctioned runner coupling (I1) — their
                // Imports are the framework's own seam, not prod leakage.
                files: [
                    'src/vitest/**',
                    // Each facet's project, and the run lifecycle it owns.
                    'src/facets/*/*.project.ts',
                    'src/facets/api/routes/**',
                    'src/facets/cli/documents/literate-plugin.ts',
                    'src/facets/mobile/session/**',
                    // The page a component renders into, and the browser the
                    // Website facet drives.
                    'src/facets/component/**',
                    'src/facets/website/browser/**',
                    // The network double's engine, time, and the doubles.
                    'src/world/stubs/interceptor/**',
                    'src/world/clock/**',
                    'src/world/mocks/**',
                    // The container server's address is a provided value.
                    'src/world/services/containers/service-container.ts',
                    // A scratch directory ends with the test that asked for it.
                    'src/kernel/files/scratch.ts',
                    'src/expectations/goldens/**',
                    'src/expectations/in-place/**',
                ],
                rules: { 'jterrazz/f2-no-test-imports-in-prod': 'off' },
            },
        ],
        rules: {
            // reason: `verbatimModuleSyntax` keeps the statement of an inline
            // Type specifier — `import { type X } from 'm'` emits `import {}
            // From 'm'`, a runtime edge, where `import type` is erased whole.
            // The rulebook's default (`prefer-inline`) therefore turns every
            // Type-only import into a real one, and a type-only cycle between
            // two modules into a load-order crash. The rule stays ON, at the
            // Spelling the compiler erases.
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
