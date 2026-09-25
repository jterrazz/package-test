import { compose, defineConfig, node } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

// Node's type-stripping does not resolve `.js` specifiers to `.ts` sources: `npm run build` precedes lint.
import { testing } from './dist/oxlint.js';
import { FRAMEWORK_LAYERS, selfRules } from './dist/self-oxlint.js';

// This repository is the package the fragment names, so it lints itself from the bundle it just built, plus the self plugin.
const selfTesting = {
    ...testing,
    jsPlugins: ['./dist/oxlint.js', './dist/self-oxlint.js'],
    rules: { ...testing.rules, ...selfRules },
};

const config: OxlintConfig = defineConfig(
    compose(node, selfTesting, {
        overrides: [
            {
                // These module tests unit-test the constructors, which is creating a runner outside a specification.
                files: ['src/**/*.test.ts', 'lint/**/*.test.ts'],
                rules: { 'jterrazz/a1-specification-file': 'off' },
            },
            {
                // The sanctioned runner coupling (I1): the modules whose engine is a test package.
                files: [
                    'src/vitest/**',
                    'src/facets/*/*.project.ts',
                    'src/facets/api/routes/**',
                    'src/facets/cli/documents/literate-plugin.ts',
                    'src/facets/mobile/session/mobile-session.ts',
                    'src/facets/mobile/session/session-ledger.ts',
                    'src/facets/mobile/server/appium-server.ts',
                    'src/facets/component/page/**',
                    'src/facets/component/golden/**',
                    'src/facets/website/browser/playwright.adapter.ts',
                    'src/world/stubs/network/**',
                    'src/world/clock/**',
                    'src/world/mocks/**',
                    'src/world/services/containers/service-container.ts',
                    'src/kernel/files/scratch.ts',
                    'src/expectations/goldens/**',
                    'src/expectations/in-place/**',
                ],
                rules: { 'jterrazz/f2-no-test-imports-in-prod': 'off' },
            },
        ],
        rules: {
            // reason: under `verbatimModuleSyntax` an inline type specifier still emits `import {} from 'm'`, a runtime edge, so a type-only cycle becomes a load-order crash; `import type` is erased whole.
            'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
            // The rule ships inert: an architecture is the project's to declare.
            'jterrazz/i1-layer-boundaries': ['error', { layers: FRAMEWORK_LAYERS }],
        },
    }),
);

export default config;
