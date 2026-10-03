import { defineConfig } from '@jterrazz/typescript/config';
import type { Preset } from '@jterrazz/typescript/config';
import { existsSync } from 'node:fs';

// This repository's presets are its own build, and the build reads this file before there is one to import.
const PRESETS = ['./dist/config.js', './.artifacts/dev/self-config.js'];

const built = PRESETS.every((path) => existsSync(new URL(path, import.meta.url)));

async function builtPresets(): Promise<Preset[]> {
    const { test } = await import('./dist/config.js');
    const { self } = await import('./.artifacts/dev/self-config.js');

    return [test(), self()];
}

const presets: Preset[] = built ? await builtPresets() : [];

const UNTESTED_IN_PRODUCTION = [
    'src/index.vitest.ts',
    'src/index.vitest.config.ts',
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
];

const READS_THE_SOURCES =
    'it reads the sources as text or as types, and sees the instrumented ones';

export default defineConfig({
    kind: 'library',
    optOuts: {
        'typescript/self-folders-apart':
            'the corpus audits the self checker and the self plugin by importing them, and one self check reads the capability matrix the corpus renders (docs/01-architecture.md)',
    },
    platform: 'node',
    presets,
    test: {
        projects: [
            { exclude: [], facet: 'unit', include: ['src/**/*.test.ts', 'lint/**/*.test.ts'] },
            { facet: 'lint' },
            {
                facet: 'cli',
                literate: {
                    include: ['specs/cli/run/*.spec.yaml'],
                    specification: './specs/cli/literate-cli.specification.ts',
                },
                setup: ['specs/cli/_setup/packed/per-run.ts'],
            },
            { facet: 'api' },
            { facet: 'job' },
            { facet: 'integration', serial: true },
            { facet: 'website' },
            { facet: 'mobile', setup: ['specs/_shared/_setup/appium/per-run.ts'] },
            {
                clock: '2026-01-02T03:04:05.000Z',
                facet: 'component',
                include: ['specs/component/**/*.test.tsx', 'src/**/*.test.tsx'],
                locale: 'fr-FR',
                root: 'specs/component',
                timezone: 'Europe/Paris',
                viewport: { height: 640, width: 1024 },
                vite: {
                    optimizeDeps: { include: ['react-router', '@jterrazz/typescript/rules'] },
                    resolve: { alias: { '@jterrazz/test': './dist/browser/index.js' } },
                },
                wrap: './wrap/providers.tsx',
            },
        ],
    },
    typescript: {
        build: {
            dev: {
                'route-split': {
                    reason: 'CI merges the shards of the route ratchet with it, from the Makefile',
                    source: 'src/facets/api/routes/route-split-cli.ts',
                },
                schema: {
                    reason: '`npm run docs` writes the spec document schema with it',
                    source: 'src/facets/cli/documents/schema-cli.ts',
                },
                self: {
                    reason: 'the self checks, which the self preset runs by path',
                    source: 'lint/self/self-cli.ts',
                },
                'self-config': {
                    reason: 'the self preset this file lists',
                    source: 'lint/self/preset.ts',
                },
                'self-oxlint': {
                    reason: 'the self lint plugin, which the self preset loads by path',
                    source: 'lint/self/rules/plugin.ts',
                },
            },
            entries: {
                'in-place-setup': {
                    reason: 'a global setup the facets hand vitest by path',
                    source: 'src/expectations/in-place/in-place-setup.ts',
                },
                'mobile-session': {
                    reason: 'a global setup mobile() hands vitest by path',
                    source: 'src/facets/mobile/session/mobile-session.ts',
                },
                'route-coverage': {
                    reason: 'a global setup api() hands vitest by path',
                    source: 'src/facets/api/routes/route-coverage.ts',
                },
                'services-setup': {
                    reason: 'a global setup the service facets hand vitest by path',
                    source: 'src/services/containers/run-setup.ts',
                },
                'temp-root': {
                    reason: 'a global setup the facets hand vitest by path',
                    source: 'src/chain/paths/temp-root.ts',
                },
            },
        },
        mutation: {
            exclude: {
                'lint/self/checks/error-is-a-refusal-or-an-invariant.test.ts': READS_THE_SOURCES,
                'lint/self/corpus/docs-typecheck.test.ts': READS_THE_SOURCES,
                'lint/self/corpus/env-allowlist.test.ts': READS_THE_SOURCES,
                'lint/self/corpus/messages.test.ts': READS_THE_SOURCES,
                'lint/self/corpus/type-channel.test.ts': READS_THE_SOURCES,
                'src/chain/paths/temp-root.test.ts':
                    'the temp root is the run’s own, and cannot judge a mutant',
            },
        },
        oxfmt: {
            ignore: {
                schema: '`npm run docs` generates it byte for byte, and a formatter pass would make the two disagree',
            },
        },
        oxlint: {
            overrides: [
                {
                    files: ['src/**/*.test.ts', 'lint/**/*.test.ts'],
                    reason: 'these module tests unit-test the constructors, which is creating a runner outside a specification',
                    rules: { 'jterrazz/runner-in-specification-file': 'off' },
                },
                {
                    files: UNTESTED_IN_PRODUCTION,
                    reason: 'the framework’s own runtime is test code by nature, and ships',
                    rules: { 'jterrazz/no-test-code-in-production': 'off' },
                },
            ],
            rules: {
                'import/consistent-type-specifier-style': {
                    level: ['error', 'prefer-top-level'],
                    reason: 'under `verbatimModuleSyntax` an inline type specifier still emits `import {} from "m"`, a runtime edge, so a type-only cycle becomes a load-order crash; `import type` is erased whole',
                },
            },
        },
        roots: {
            schema: 'the JSON Schema of a `<case>.spec.yaml` document, published as `@jterrazz/test/schema` and generated by `npm run docs`',
        },
        tsconfig: {
            compilerOptions: {
                paths: { '@jterrazz/test': ['./src/index.browser.ts'] },
            },
            reason: 'the component tests import the package by its public name, typed from the browser source',
        },
    },
});
