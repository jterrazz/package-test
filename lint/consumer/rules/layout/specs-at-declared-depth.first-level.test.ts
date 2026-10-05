import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { isStrayFolder } from './specs-at-declared-depth.first-level.js';

function specsTree(paths: readonly string[]): string {
    const scratch = mkdtempSync(join(tmpdir(), 'first-level-'));
    const root = join(scratch, 'specs');
    for (const path of paths) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), '');
    }
    return root;
}

describe('isStrayFolder', () => {
    test('a folder of helpers holding no test is stray, at any depth below it', () => {
        // Given - a support folder of mocks and helpers beside a specification
        const root = specsTree([
            'support/next-cursor.ts',
            'support/domain/article.mocks.ts',
            'api/events/list/listing.spec.ts',
        ]);

        // Then - each of its modules sits in a stray folder
        expect([
            isStrayFolder(root, ['support', 'next-cursor.ts']),
            isStrayFolder(root, ['support', 'domain', 'article.mocks.ts']),
        ]).toStrictEqual([true, true]);
    });

    test('a specification, the shared ground and a suite holding tests are places a tree has', () => {
        // Given - a specification helper, the shared ground's code, a suite's tests and its helper
        const root = specsTree([
            'api/events/_setup/seeded-at.ts',
            '_shared/_fixtures/app/app.ts',
            'surface/package/exports.test.ts',
            'surface/package/_setup/packed-tree.ts',
            'guards/rules/rules.spec.yaml',
            'guards/rules/_setup/rule-rows.ts',
        ]);

        // Then - none of them is stray
        expect([
            isStrayFolder(root, ['api', 'events', '_setup', 'seeded-at.ts']),
            isStrayFolder(root, ['_shared', '_fixtures', 'app', 'app.ts']),
            isStrayFolder(root, ['surface', 'package', '_setup', 'packed-tree.ts']),
            isStrayFolder(root, ['guards', 'rules', '_setup', 'rule-rows.ts']),
        ]).toStrictEqual([false, false, false, false]);
    });

    test('a test under node_modules makes no suite', () => {
        // Given - a folder whose only test is an installed package's
        const root = specsTree(['support/node_modules/pkg/pkg.test.ts', 'support/helper.ts']);

        // Then - the folder holds no test of its own
        expect(isStrayFolder(root, ['support', 'helper.ts'])).toBe(true);
    });

    test('a test under a ground folder makes no suite', () => {
        // Given - a folder whose only test is a fixture tree's
        const root = specsTree(['support/_fixtures/tree/tree.test.ts', 'support/helper.ts']);

        // Then - the folder holds no test of its own
        expect(isStrayFolder(root, ['support', 'helper.ts'])).toBe(true);
    });
});
