import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { recommendedRules } from '../../catalogue/manifest.js';
import { importRulesForSpecifications } from '../import.js';
import { TEST_COMMENT_OPENINGS, testPreset } from '../preset.js';
import { vitestOnTests } from '../vitest.js';

describe('preset', () => {
    test('testPreset — the test preset — hands on its standard as written — the defaults of the test section, beside the file they come from', () => {
        // Given - the preset a repository lists
        const preset = testPreset();

        // Then - its section's defaults are the standard's, named by their file
        const defaults = {
            projects: {
                unit: {
                    isolate: false,
                    reason: 'a module test leaves no state behind in a module, so a worker runs its files in one module graph',
                },
            },
            specifications: [
                'api',
                'cli',
                'component',
                'integration',
                'job',
                'lint',
                'mobile',
                'website',
            ],
        };
        expect([preset.name, preset.package, preset.settings, preset.origins]).toStrictEqual([
            'test',
            '@jterrazz/test',
            defaults,
            [{ file: 'src/standard/standard.ts', settings: defaults }],
        ]);
    });

    test('testPreset — the test preset — what it holds a repository to — its lint, its checks, its derived vitest config and its debt', () => {
        // Given - the preset a repository lists
        const preset = testPreset();

        // Then - the plugin and its rules, the comment openings it adds, the checker, the editor file, and the section it records
        expect([
            preset.baseline,
            preset.oxlint,
            preset.checker?.label,
            preset.checker?.module.endsWith('checker.js'),
            preset.files,
        ]).toStrictEqual([
            ['test'],
            {
                jsPlugins: ['@jterrazz/test/oxlint'],
                overrides: [importRulesForSpecifications, vitestOnTests],
                rules: {
                    ...recommendedRules,
                    'jterrazz-typescript/comment-states-its-kind': [
                        'error',
                        { openings: [...TEST_COMMENT_OPENINGS] },
                    ],
                },
            },
            'Test Conventions (@jterrazz/test)',
            true,
            {
                'vitest.config.ts': {
                    scope: 'unit',
                    text: "import { vitestConfig } from '@jterrazz/test/vitest';\n\nexport default await vitestConfig(import.meta.url);\n",
                },
            },
        ]);
    });

    test('testPreset — the test preset — derives the test projects of a tree for doctor to show', () => {
        // Given - a tree holding a module test and the api specs
        const root = mkdtempSync(join(tmpdir(), 'test-preset-'));
        mkdirSync(join(root, 'src/__tests__'), { recursive: true });
        mkdirSync(join(root, 'specs/api'), { recursive: true });
        writeFileSync(join(root, 'src/__tests__/orders.test.ts'), '');

        // Then - the projects the vitest config builds from it
        expect(testPreset().derive?.(root)).toStrictEqual({
            projects: { api: {}, unit: { roots: ['src'] } },
        });
    });

    test('testPreset — the test preset — names as knip entries the wrap files its projects load by path, each from its project root', () => {
        // Given - a component project rooted in a member, one at the repository root, one wrapping nothing, a malformed one, and a section declaring no project
        const section = {
            projects: {
                broken: 'component',
                component: { root: 'apps/web', wrap: './src/frame.tsx' },
                plain: { roots: ['src'] },
                site: { wrap: 'src/../frame.tsx' },
            },
        };

        // Then - each wrap file under its root, normalised, and nothing for the others
        expect([
            testPreset().entries?.(section, '/nowhere'),
            testPreset().entries?.({}, '/nowhere'),
        ]).toStrictEqual([['apps/web/src/frame.tsx', 'frame.tsx'], []]);
    });

    test('testPreset — the test preset — names as entries the specification modules only documents bind, and as loaded the peers its projects drive', () => {
        // Given - a tree with a cli folder holding its specification module, an api folder without one, a website folder and a mobile folder
        const root = mkdtempSync(join(tmpdir(), 'test-preset-loaded-'));
        for (const folder of ['cli', 'api', 'website', 'mobile']) {
            mkdirSync(join(root, 'specs', folder), { recursive: true });
        }
        writeFileSync(join(root, 'specs/cli/cli.specification.ts'), '');
        const bare = mkdtempSync(join(tmpdir(), 'test-preset-bare-'));
        mkdirSync(join(bare, 'src/__tests__'), { recursive: true });
        writeFileSync(join(bare, 'src/__tests__/orders.test.ts'), '');

        // Then - the module that exists is an entry, the mobile's and the website's peers are loaded, the component's are not asked for, and a tree of module tests loads none
        expect([
            testPreset().entries?.({}, root),
            testPreset().loadedPackages?.(root),
            testPreset().loadedPackages?.(bare),
        ]).toStrictEqual([
            ['specs/cli/cli.specification.ts'],
            ['appium', 'webdriverio', '@vitest/browser-playwright', 'playwright'],
            [],
        ]);
    });
});
