import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';

import {
    api,
    cli,
    component,
    defineSpecConfig,
    integration,
    job,
    literate,
    mobile,
    unit,
    website,
} from './src/vitest/index.js';

const config = defineSpecConfig({
    test: {
        projects: [
            // `specs/lint/` lints fixture projects through the real oxlint binary, so it runs here, after `npm run build`.
            {
                ...unit({
                    exclude: [],
                    include: ['src/**/*.test.ts', 'lint/**/*.test.ts', 'specs/lint/**/*.test.ts'],
                }),
                plugins: [
                    literate({
                        include: ['specs/lint/*/*.spec.yaml'],
                        specification: './specs/lint/report.specification.ts',
                    }),
                ],
            },
            // Depth 1 only: the deliberately-wrong twins under `run/_fixtures/` stay inputs to the negative specs.
            cli({
                literate: {
                    include: ['specs/cli/run/*.spec.yaml'],
                    specification: './specs/cli/literate-cli.specification.ts',
                },
            }),
            api(),
            job(),
            // Serial: its probes start their own infrastructure, and in parallel they starve each other's healthchecks.
            integration({ serial: true }),
            website(),
            // The protocol double's setup comes first, so it still answers when `mobile()`'s own ends the session.
            mergeConfig(
                {
                    test: {
                        globalSetup: [
                            resolve(import.meta.dirname, 'specs/_shared/_setup/appium/per-run.ts'),
                        ],
                    },
                },
                mobile(),
            ),
            component({
                // Every value is away from its default, so the app proves each one reaches the page.
                clock: '2026-01-02T03:04:05.000Z',
                include: ['specs/component/**/*.test.tsx'],
                locale: 'fr-FR',
                // `wrap` is read against the app's folder, not the config's.
                root: resolve(import.meta.dirname, 'specs/component'),
                timezone: 'Europe/Paris',
                viewport: { height: 640, width: 1024 },
                vite: {
                    // The one dependency the seam does not pre-bundle for the app.
                    optimizeDeps: { include: ['react-router'] },
                    resolve: {
                        // The public specifier resolves to the browser entry's source; `tsconfig`'s `paths` mirrors it.
                        alias: {
                            '@jterrazz/test': resolve(import.meta.dirname, 'src/index.browser.ts'),
                        },
                    },
                },
                wrap: './wrap/providers.tsx',
            }),
        ],
    },
});

// The checker runs as a child process, so its coverage is collected there and remapped to the sources before `dist/` is excluded.
const coverage = config.test?.coverage;
if (coverage?.provider === 'v8') {
    coverage.autoAttachSubprocess = true;
    coverage.excludeAfterRemap = true;
    coverage.exclude = (coverage.exclude ?? []).filter((glob) => glob !== 'dist/**');
}

export default config;
