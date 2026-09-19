import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { declaredSubpaths } from './package-exports.js';

/** The repository root, from this module's place inside `src/lint/`. */
const ROOT = resolve(import.meta.dirname, '../..');

/** The package's own manifest, as the published contract states it. */
function ownManifest(): { exports: Record<string, Record<string, string> | string> } {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: the shape asserted here is the one the assertions below read, and a wrong one fails them
    return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        exports: Record<string, Record<string, string> | string>;
    };
}

/**
 * A built entry, by its path in `dist/`. The specifier is computed, so the
 * import is `any` by construction — and the shape it resolves to is exactly
 * what the tests below are here to compare.
 */
async function builtEntry(path: string): Promise<Record<string, unknown>> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a computed specifier resolves to `any`: naming the module's shape is exactly what these tests compare
    return (await import(resolve(ROOT, path))) as Record<string, unknown>;
}

function manifestAt(dir: string, manifest: unknown): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify(manifest));
}

describe('package-exports — F1 reads the published contract', () => {
    test('lists every subpath of the exports map, never the root', () => {
        // Given - an install whose manifest publishes two subpaths
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, {
            exports: { '.': {}, './oxlint': {}, './vitest': {} },
            name: '@jterrazz/test',
        });
        const dist = resolve(root, 'dist');
        mkdirSync(dist, { recursive: true });

        // Then - the root export is not a subpath; the other two are, specifier-formed
        expect(declaredSubpaths(dist)).toStrictEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/vitest',
        ]);
    });

    test('the walk stops at the first manifest — a host project vouches for nothing', () => {
        // Given - a consumer manifest sitting above, with subpaths of its own
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, { exports: { './anything': {} }, name: 'some-consumer' });
        const nested = resolve(root, 'node_modules/other/dist');
        mkdirSync(nested, { recursive: true });

        // Then - a foreign manifest ends the search: no exemption is inherited
        expect(declaredSubpaths(nested)).toStrictEqual([]);
    });

    test('no manifest at all yields no exemption — F1 applies plainly', () => {
        // Given - a directory with nothing above it to read
        const orphan = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));

        // Then - with no contract to read, no subpath can be vouched for
        expect(declaredSubpaths(orphan)).toStrictEqual([]);
    });

    test("this package's own manifest is what the rule actually reads", () => {
        // Given - the framework linting itself, resolved from this module
        const subpaths = declaredSubpaths();

        // Then - every published surface is exempt, and nothing else is
        expect(subpaths).toStrictEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/schema',
            '@jterrazz/test/vitest',
        ]);
    });
});

describe('package-exports — the root has two runtimes and one type surface', () => {
    test('the root export answers a page under the browser condition', () => {
        // Given - the published map of the root export
        const root = ownManifest().exports['.'];

        // Then - a page gets the browser build, node keeps the ESM one, types are shared
        expect(root).toStrictEqual({
            browser: './dist/browser/index.js',
            import: './dist/index.js',
            types: './dist/index.d.ts',
        });
    });

    test('the browser build carries every name the node build exports', async () => {
        // Given - both built entries, loaded side by side (`npm run build` first)
        const node = await builtEntry('dist/index.js');
        const browser = await builtEntry('dist/browser/index.js');

        // Then - one surface: neither side has a name the other lacks
        expect(Object.keys(browser).toSorted()).toStrictEqual(Object.keys(node).toSorted());
    });

    test('a node-only name is present in the page and refuses where it was called', async () => {
        // Given - the browser build's `specification`, whose facets need a server
        const browser = await builtEntry('dist/browser/index.js');
        const facets = Object.values(browser.specification ?? {});

        // Then - every facet refuses, naming itself and where it runs
        expect(facets).toHaveLength(5);
        for (const facet of facets) {
            expect(facet).toThrow(/specification\.\w+\(\) runs under node/u);
        }
        expect(browser.postgres).toThrow(/postgres\(\) runs under node/u);
    });
});
