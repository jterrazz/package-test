import { compose, defineConfig, fromPresets } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

import settings from './jterrazz.config.ts';

const config: OxlintConfig = defineConfig(
    compose(fromPresets(settings), {
        overrides: [
            {
                // These module tests unit-test the constructors, which is creating a runner outside a specification.
                files: ['src/**/*.test.ts', 'lint/**/*.test.ts'],
                rules: { 'jterrazz/runner-in-specification-file': 'off' },
            },
            {
                files: [
                    'src/index.vitest.ts',
                    'src/vitest/**',
                    'src/facets/*/*.project.ts',
                    'src/facets/api/routes/**',
                    'src/facets/cli/documents/literate-plugin.ts',
                    'src/facets/mobile/session/mobile-session.ts',
                    'src/facets/mobile/session/session-ledger.ts',
                    'src/facets/mobile/server/appium-server.ts',
                    'src/facets/component/page/**',
                    'src/facets/component/golden/**',
                    'src/facets/lint/rule-tester.ts',
                    'src/facets/website/browser/playwright.adapter.ts',
                    'src/stubs/delivery/**',
                    'src/clock/**',
                    'src/mocks/**',
                    'src/services/containers/service-container.adapter.ts',
                    'src/chain/paths/scratch.ts',
                    'src/expectations/goldens/**',
                    'src/expectations/in-place/**',
                ],
                rules: { 'jterrazz/no-test-code-in-production': 'off' },
            },
        ],
        rules: {
            // reason: under `verbatimModuleSyntax` an inline type specifier still emits `import {} from 'm'`, a runtime edge, so a type-only cycle becomes a load-order crash; `import type` is erased whole.
            'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
        },
    }),
);

export default config;
