import { oxlintConfig } from '@jterrazz/typescript/oxlint';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

import { typeAwareFindings } from './type-aware.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const derived = await oxlintConfig(pathToFileURL(join(ROOT, 'oxlint.config.ts')).href);
const CACHE = resolve(ROOT, 'node_modules/.cache');
const FLOATING = 'typescript/no-floating-promises';
const THENABLE = 'typescript/await-thenable';

function refusedLines(source: string): number[] {
    return source
        .split('\n')
        .flatMap((text, index) => (text.endsWith('// refused') ? [index + 1] : []));
}

function linted(rule: string, body: readonly string[]): { findings: unknown; source: string } {
    mkdirSync(CACHE, { recursive: true });
    const source = [
        "import { expect } from 'vitest';",
        '',
        `import { directory, file } from '${ROOT}/src/index.js';`,
        `import type { ContainerAccessor, DirectoryAccessor, JsonAccessor, TableAccessor } from '${ROOT}/src/index.js';`,
        '',
        'declare const table: TableAccessor;',
        'declare const container: ContainerAccessor;',
        'declare const tree: DirectoryAccessor;',
        'declare const json: JsonAccessor;',
        '',
        ...body,
        '',
    ].join('\n');
    return {
        findings: typeAwareFindings({ cacheDir: CACHE, root: ROOT, rules: [rule], source }),
        source,
    };
}

describe('typeAwareFindings', () => {
    test('the type-aware rules a missed or a needless `await` is judged by (meta-test) — the config this repository derives runs no-floating-promises and await-thenable type-aware, as errors', () => {
        // Given - the config the toolchain derives for this repository, on node
        const profiles = { node: derived };

        // Then - each lints type-aware and holds both rules at error, so no rule of this plugin judges an `await` on a matcher
        const held = Object.fromEntries(
            Object.entries(profiles).map(([name, profile]) => [
                name,
                {
                    floating: profile.rules?.[FLOATING],
                    thenable: profile.rules?.[THENABLE],
                    typeAware: profile.options?.typeAware,
                },
            ]),
        );
        expect(held).toStrictEqual(
            Object.fromEntries(
                Object.keys(profiles).map((name) => [
                    name,
                    { floating: 'error', thenable: 'error', typeAware: true },
                ]),
            ),
        );
    });

    test('the type-aware rules a missed or a needless `await` is judged by (meta-test) — an IO matcher dropped is refused, and every form that handles its promise is not', () => {
        // Given - each IO matcher, typed by this package's augmentation, dropped and handled
        const { findings, source } = linted(FLOATING, [
            'export async function forms(): Promise<void> {',
            "    expect(table).toMatch([[1, 'Ada']]); // refused",
            "    expect(table).toMatch(''); // refused",
            "    expect(tree).toMatch(directory('./_expected/tree/')); // refused",
            '    expect(table).toBeEmpty(); // refused',
            '    expect(table).not.toBeEmpty(); // refused',
            '    expect(container).toBeRunning(); // refused',
            "    await expect(table).toMatch([[1, 'Ada']]);",
            "    await expect(tree).toMatch(directory('./_expected/tree/'));",
            '    await expect(table).toBeEmpty();',
            '    await expect(expect(container).toBeRunning()).rejects.toThrow();',
            '    const pending = expect(table).toBeEmpty();',
            '    await pending;',
            '}',
            '',
            'export async function returned(): Promise<void> {',
            "    return expect(tree).toMatch(directory('./_expected/tree/'));",
            '}',
        ]);

        // Then - no-floating-promises fires on each bare statement, and on nothing else
        expect(findings).toStrictEqual(
            refusedLines(source).map((line) => ({ line, rule: FLOATING })),
        );
    });

    test('the type-aware rules a missed or a needless `await` is judged by (meta-test) — an await on a synchronous matcher is refused, and one on an IO matcher or a promise is not', () => {
        // Given - the synchronous matchers awaited, beside the awaits that hold a promise
        const { findings, source } = linted(THENABLE, [
            'export async function forms(): Promise<void> {',
            '    await expect(1).toBe(1); // refused',
            '    await expect({ id: 1 }).toEqual({ id: 1 }); // refused',
            '    await expect([1]).toContain(1); // refused',
            '    await expect([1]).toHaveLength(1); // refused',
            "    await expect(json).toMatch(file('./_expected/body.json')); // refused",
            "    await expect(table).toMatch([[1, 'Ada']]);",
            '    await expect(container).toBeRunning();',
            '    await expect(Promise.resolve(1)).resolves.toBe(1);',
            '}',
        ]);

        // Then - await-thenable fires on each synchronous one, and on nothing else
        expect(findings).toStrictEqual(
            refusedLines(source).map((line) => ({ line, rule: THENABLE })),
        );
    });

    test('the upstream rules `no-existence-only-assertion` hands two of its shapes to (meta-test) — the config this repository derives refuses `toBeTruthy` and a bare `toThrow` in a test file, wherever they stand', () => {
        // Given - the derived config, and a test holding each shape beside the forms that state the value
        const profiles = { node: derived };
        const { findings, source } = linted('vitest/prefer-strict-boolean-matchers', [
            'export function forms(ready: boolean, build: () => void): void {',
            '    expect(ready).toBeTruthy(); // refused',
            '    expect(ready).toBeFalsy(); // refused',
            '    expect(ready).toBe(true);',
            "    expect(build).toThrow('name is required');",
            '}',
        ]);
        const bare = linted('vitest/require-to-throw-message', [
            'export function forms(build: () => void): void {',
            '    expect(build).toThrow(); // refused',
            "    expect(build).toThrow('name is required');",
            '}',
        ]);

        // Then - the derived config arms both rules on test files, and each fires on its shape alone
        const armed = Object.fromEntries(
            Object.entries(profiles).map(([name, profile]) => {
                const rules = (profile.overrides ?? []).find((layer) =>
                    layer.files.includes('**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}'),
                )?.rules;
                return [
                    name,
                    {
                        boolean: rules?.['vitest/prefer-strict-boolean-matchers'],
                        throw: rules?.['vitest/require-to-throw-message'],
                    },
                ];
            }),
        );
        expect(armed).toStrictEqual(
            Object.fromEntries(
                Object.keys(profiles).map((name) => [name, { boolean: 'error', throw: 'error' }]),
            ),
        );
        expect(findings).toStrictEqual(
            refusedLines(source).map((line) => ({
                line,
                rule: 'vitest/prefer-strict-boolean-matchers',
            })),
        );
        expect(bare.findings).toStrictEqual(
            refusedLines(bare.source).map((line) => ({
                line,
                rule: 'vitest/require-to-throw-message',
            })),
        );
    });
});
