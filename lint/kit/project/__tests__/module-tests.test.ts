import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { isTestsFolderGround, moduleTestsOf, testsFoldersOf } from '../module-tests.js';

function member(paths: string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'module-tests-'));
    for (const path of paths) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), '');
    }
    return root;
}

describe('module-tests', () => {
    test('the module tests of a member — what `named-path-exists` and the ground fixers read beside specs/ — reads the module tests of a member, outside specs/, ground and nested packages', () => {
        // Given - module tests beside their modules, and tests the walk leaves to others
        const root = member([
            'lint/consumer/checks/__tests__/checker.test.ts',
            'src/report/report.test.ts',
            'src/report/report.ts',
            'src/report/__fixtures__/tool/tool.test.ts',
            'specs/api/users/listed.spec.ts',
            'packages/inner/package.json',
            'packages/inner/src/inner.test.ts',
            'node_modules/dependency/dependency.test.ts',
        ]);

        // Then - only the member's own module tests
        expect(
            moduleTestsOf(root)
                .map((path) => relative(root, path))
                .toSorted(),
        ).toStrictEqual([
            'lint/consumer/checks/__tests__/checker.test.ts',
            'src/report/report.test.ts',
        ]);
    });

    test("testsFoldersOf — the folders a member's module tests sit in — names each __tests__/ once, and no folder a test sits in otherwise", () => {
        // Given - two tests in one __tests__/, one in another, and one beside its module in the old layout
        const root = member([
            'src/report/__tests__/report.test.ts',
            'src/report/__tests__/table.test.ts',
            'lint/rules/__tests__/rule.test.ts',
            'src/legacy/legacy.test.ts',
        ]);

        // Then - each __tests__/ folder, once
        expect(
            testsFoldersOf(root)
                .map((folder) => relative(root, folder))
                .toSorted(),
        ).toStrictEqual(['lint/rules/__tests__', 'src/report/__tests__']);
    });

    test('isTestsFolderGround — the ground a module test stands on — is a ground folder right inside a __tests__/, and nothing else', () => {
        // Given - ground inside __tests__/, ground beside it, a test inside it, and a ground folder further down
        // Then - only the first is
        expect(
            [
                'src/render/__tests__/__expected__/notes.txt',
                'src/render/__expected__/notes.txt',
                'src/render/__tests__/heading.test.ts',
                'src/render/__tests__/fixtures/__expected__/x.txt',
                String.raw`src\render\__tests__\__fixtures__\shop`,
            ].map((path) => isTestsFolderGround(path)),
        ).toStrictEqual([true, false, false, false, true]);
    });
});
