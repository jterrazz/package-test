import { astro, bun, expo, next, node, react } from '@jterrazz/typescript/oxlint';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { typeAwareFindings } from './type-aware.js';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, 'node_modules/.cache');
const FLOATING = 'typescript/no-floating-promises';

/** The lines of `source` that end on `// refused`. */
function refusedLines(source: string): number[] {
    return source
        .split('\n')
        .flatMap((text, index) => (text.endsWith('// refused') ? [index + 1] : []));
}

describe('the type-aware rules D2 hands its promise matchers to (meta-test)', () => {
    test('every profile of the toolchain runs no-floating-promises type-aware, as an error', () => {
        // Given - the six profiles a consumer composes
        const profiles = { astro, bun, expo, next, node, react };

        // Then - each lints type-aware and refuses a floating promise, so the two matchers need no rule of this plugin
        const held = Object.fromEntries(
            Object.entries(profiles).map(([name, profile]) => [
                name,
                { rule: profile.rules?.[FLOATING], typeAware: profile.options?.typeAware },
            ]),
        );
        expect(held).toStrictEqual(
            Object.fromEntries(
                Object.keys(profiles).map((name) => [name, { rule: 'error', typeAware: true }]),
            ),
        );
    });

    test('a bare toBeEmpty or toBeRunning is refused, and every form that handles the promise is not', () => {
        // Given - the two matchers in each form D2 once judged, typed by this package's augmentation
        mkdirSync(CACHE, { recursive: true });
        const source = [
            "import { expect } from 'vitest';",
            '',
            `import type { ContainerAccessor } from '${ROOT}/src/index.js';`,
            `import type { TableAccessor } from '${ROOT}/src/results/table.js';`,
            '',
            'declare const table: TableAccessor;',
            'declare const container: ContainerAccessor;',
            '',
            'export async function forms(): Promise<void> {',
            '    expect(table).toBeEmpty(); // refused',
            '    expect(table).not.toBeEmpty(); // refused',
            '    expect(container).toBeRunning(); // refused',
            '    await expect(table).toBeEmpty();',
            '    await expect(expect(container).toBeRunning()).rejects.toThrow();',
            '    const pending = expect(table).toBeEmpty();',
            '    await pending;',
            '}',
            '',
            'export async function returned(): Promise<void> {',
            '    return expect(container).toBeRunning();',
            '}',
            '',
        ].join('\n');

        // Then - the rule fires on each bare statement, and on nothing else
        const findings = typeAwareFindings({
            cacheDir: CACHE,
            root: ROOT,
            rules: [FLOATING],
            source,
        });
        expect(findings).toStrictEqual(
            refusedLines(source).map((line) => ({ line, rule: FLOATING })),
        );
    });
});
