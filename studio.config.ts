import { defineConfig, ownPresets } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    optOuts: {
        'test/no-second-test-runtime-network':
            'this repository builds the network seam: the module test of the handlers that wrap msw drives msw itself, so self() holds every other test file to the same law',
        'typescript/self-folders-apart':
            'the corpus audits the self checker and the self plugin by importing them, and one self check reads the capability matrix the corpus renders (docs/concepts/architecture.md)',
    },
    platform: 'node',
    presets: ownPresets(import.meta.url, {
        './dist/config.js': 'test',
        './.artifacts/dev/preset.js': 'self',
    }),
    test: {
        production: {
            allow: {
                '@vitest/browser-playwright':
                    'the component specification runs its pages in a browser through this provider',
                msw: 'the network stubs the api specification hands a test are msw handlers',
                playwright: 'the website specification visits its pages through Playwright',
                vitest: 'the framework builds its projects and assertions on vitest, and ships them',
                'vitest-browser-react':
                    'the component specification renders its pages through this renderer',
                'vitest-mock-extended': 'the mocks a test asks for are built by it',
            },
        },
        projects: {
            cli: {
                literate: {
                    include: ['specs/cli/run/*.spec.yaml'],
                    runner: './specs/cli/literate-cli.specification.ts',
                },
                reason: 'the documents under run/ drive the literate specimen through its own runner, and those under env/ and fixture/ are the input of the specs proving those keys; the Go specimen is built once per run, since every runner module runs again before each file of every worker',
                setup: ['specs/cli/__setup__/go/per-run.ts'],
            },
            component: {
                clock: '2026-01-02T03:04:05.000Z',
                locale: 'fr-FR',
                reason: 'the component specs prove each option of the project reaches the page (clock, locale, zone, viewport, wrap and vite pipeline) and render this package as its browser build',
                root: 'specs/component',
                timezone: 'Europe/Paris',
                viewport: { height: 640, width: 1024 },
                vite: {
                    optimizeDeps: { include: ['react-router', '@jterrazz/typescript/rules'] },
                    resolve: {
                        alias: [
                            {
                                find: '@jterrazz/test/services',
                                replacement: './dist/browser/services.js',
                            },
                            {
                                find: '@jterrazz/test/stubs',
                                replacement: './dist/browser/stubs.js',
                            },
                            { find: '@jterrazz/test', replacement: './dist/browser/index.js' },
                        ],
                    },
                },
                wrap: './wrap/providers.tsx',
            },
            mobile: {
                reason: 'the mobile specs run against an Appium double the whole run shares, unless a real server is named, and the double gives each worker its session an app of its own, so its files run in parallel; `make test-mobile` runs them in turn on its one simulator',
                serial: false,
                setup: ['specs/__setup__/appium/per-run.ts'],
            },
        },
    },
    typescript: {
        knip: {
            ignoreBinaries: {
                go: 'the Go specimen of the cli specification is built by the Go toolchain, a machine requirement and never an npm dependency',
            },
        },
        mutation: {
            exclude: {
                'src/chain/paths/__tests__/temp-root.global-setup.test.ts':
                    "the temp root is the run's own, and cannot judge a mutant",
            },
            ignore: {
                'src/specifications/website/browser/page-scripts.ts':
                    'the functions Playwright serialises into the page, where the helpers an instrumented copy calls do not exist: a mutated build throws before it reads or seeds anything; module test and specs/website judge them',
            },
        },
        roots: {
            schema: {
                reason: 'the JSON Schema of a `<case>.spec.yaml` document, published as `@jterrazz/test/schema` and written byte for byte by `npm run docs`',
                verbatim: true,
            },
        },
        tsconfig: {
            compilerOptions: {
                paths: {
                    '@jterrazz/test': ['./src/index.browser.ts'],
                    '@jterrazz/test/services': ['./src/index.services.browser.ts'],
                    '@jterrazz/test/stubs': ['./src/index.stubs.browser.ts'],
                },
            },
            reason: 'the component tests import the package by its public name, typed from the browser source',
        },
    },
});
