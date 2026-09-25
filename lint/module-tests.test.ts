import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { moduleTestsOf } from './module-tests.js';

function member(paths: string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'module-tests-'));
    for (const path of paths) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), '');
    }
    return root;
}

describe('moduleTestsOf', () => {
    test('the module tests of a member — what C8 and the ground fixers read beside specs/ — reads the module tests of a member, outside specs/, ground and nested packages', () => {
        // Given - module tests beside their modules, and tests the walk leaves to others
        const root = member([
            'lint/checker.test.ts',
            'src/report/report.test.ts',
            'src/report/fixtures/tool/tool.test.ts',
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
        ).toStrictEqual(['lint/checker.test.ts', 'src/report/report.test.ts']);
    });
});
