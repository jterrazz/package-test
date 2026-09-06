import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { declaredSubpaths } from './package-exports.js';

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
        expect(declaredSubpaths(dist)).toEqual(['@jterrazz/test/oxlint', '@jterrazz/test/vitest']);
    });

    test('the walk stops at the first manifest — a host project vouches for nothing', () => {
        // Given - a consumer manifest sitting above, with subpaths of its own
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, { exports: { './anything': {} }, name: 'some-consumer' });
        const nested = resolve(root, 'node_modules/other/dist');
        mkdirSync(nested, { recursive: true });

        // Then - a foreign manifest ends the search: no exemption is inherited
        expect(declaredSubpaths(nested)).toEqual([]);
    });

    test('no manifest at all yields no exemption — F1 applies plainly', () => {
        // Given - a directory with nothing above it to read
        const orphan = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));

        // Then - with no contract to read, no subpath can be vouched for
        expect(declaredSubpaths(orphan)).toEqual([]);
    });

    test("this package's own manifest is what the rule actually reads", () => {
        // Given - the framework linting itself, resolved from this module
        const subpaths = declaredSubpaths();

        // Then - every published surface is exempt, and nothing else is
        expect(subpaths).toEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/schema',
            '@jterrazz/test/vitest',
        ]);
    });
});
