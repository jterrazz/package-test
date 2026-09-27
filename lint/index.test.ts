import { materialAt, testPackageOf } from '@jterrazz/test/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import plugin, { recommendedRules, testing } from './index.js';

const ROOT = resolve(import.meta.dirname, '..');

type MaterialReaders = { materialAt: typeof materialAt; testPackageOf: typeof testPackageOf };

function answersOf(readers: MaterialReaders): unknown[] {
    return [
        readers.materialAt(resolve(ROOT, 'src/index.test.ts')),
        readers.materialAt(resolve(ROOT, 'specs/_shared/_fixtures/api-app/app.ts')),
        readers.materialAt(resolve(ROOT, 'specs/_shared'), true),
        readers.materialAt(resolve(ROOT, 'src/index.ts')),
        readers.testPackageOf('vitest/config'),
        readers.testPackageOf('@testing-library/react'),
        readers.testPackageOf('@jterrazz/test/oxlint'),
        readers.testPackageOf('hono'),
    ];
}

describe('index', () => {
    test('the ./oxlint entry — the composable fragment — what a consumer wires — `testing` is an oxlint config, so compose(<profile>, testing) needs no assertion', () => {
        // Given - the fragment as a consumer's oxlint.config.ts receives it. The annotation IS the test: an inferred `rules` widens each severity to `string`, which oxlint's closed union refuses, and this line stops compiling — no consumer should need `testing as OxlintConfig`.
        const composed: OxlintConfig = testing;

        // Then - it carries the plugin wiring and the whole catalogue
        expect(composed.jsPlugins).toStrictEqual(['@jterrazz/test/oxlint']);
        expect(composed.rules).toStrictEqual(recommendedRules);
    });

    test('the ./oxlint entry — testing fragment — standalone oxlint config — is self-sufficient (no `extends` needed): plugin + every rule + the `cleanup-passed-to-after-all` override', () => {
        // Given - a consumer NOT using @jterrazz/typescript adopts just the conventions via `export default testing` — the fragment must be a COMPLETE oxlint config
        // Then - it registers the tool-facing plugin, enables every shipped rule, and ships the one override the `cleanup-passed-to-after-all` idiom needs — without pulling in any base preset
        expect(testing.jsPlugins).toContain('@jterrazz/test/oxlint');
        expect(testing.rules).toStrictEqual(recommendedRules);
        expect(Object.keys(recommendedRules)).toStrictEqual(
            Object.keys(plugin.rules).map((id) => `jterrazz/${id}`),
        );
        expect(testing.overrides?.[0]?.files).toContain('**/*.specification.ts');
        expect('extends' in testing).toBe(false);
    });

    test('the ./oxlint entry — testing fragment — standalone oxlint config — declares no `categories` — every rule it ships is decided by name', () => {
        // Given - the fragment, top level and every override entry (the `categories` block in specs/_shared/_fixtures/lint-cli/oxlint.e2e.json is a test harness muting oxlint's own defaults, not a config this package ships)
        const layers: Record<string, unknown>[] = [
            testing as unknown as Record<string, unknown>,
            ...((testing.overrides ?? []) as unknown as Record<string, unknown>[]),
        ];

        // Then - none of them opens a category: a category turns on rules nobody decided, and composing it over a base preset silently re-enables them
        for (const layer of layers) {
            expect('categories' in layer).toBe(false);
        }
    });

    test('the ./oxlint entry — testing fragment — standalone oxlint config — every rule is enabled, as an error', () => {
        // Given - each rule the plugin registers
        const names = Object.keys(plugin.rules).map((name) => `jterrazz/${name}`);

        // Then - the fragment enables each at `error`: oxlint's suppressions hold errors alone, so a warning would be debt no ratchet holds
        expect(recommendedRules).toStrictEqual(
            Object.fromEntries(names.map((name) => [name, 'error'])),
        );
    });

    test('the ./oxlint entry — testing fragment — standalone oxlint config — its overrides add a layer instead of replacing one', () => {
        // Given - each override entry of the fragment
        for (const entry of testing.overrides ?? []) {
            // Then - it is scoped by `files` and carries `rules` only, so a profile already holding its own overrides (v10 puts the `vitest` plugin on the test globs that way) keeps them: oxlint concatenates the arrays
            expect(entry.files.length).toBeGreaterThan(0);
            expect(Object.keys(entry).sort()).toStrictEqual(['files', 'rules']);
        }
    });

    test('the ./oxlint entry — the ./oxlint entry publishes what test material is — both builds answer materialAt and testPackageOf, typed from the published declarations', () => {
        // Given - the entry as a consumer imports it, and its CommonJS build (`npm run build` first)
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- `require` answers `any`: the ESM build's published types are the shape the CJS build must carry
        const cjs: MaterialReaders = createRequire(import.meta.url)('@jterrazz/test/oxlint');

        // Then - each build reads a module id and a specifier as the `no-test-code-in-production` guard does
        const answers = [
            'a test file',
            'the specs tree',
            'the specs tree',
            undefined,
            'vitest',
            '@testing-library/react',
            undefined,
            undefined,
        ];
        expect(answersOf({ materialAt, testPackageOf })).toStrictEqual(answers);
        expect(answersOf(cjs)).toStrictEqual(answers);
    });
});
