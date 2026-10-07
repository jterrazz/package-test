import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { checkNoSnapshotFolder } from '../no-snapshot-folder.js';

describe('checkNoSnapshotFolder', () => {
    test('a synonym of __expected__ is named under the specs always, and elsewhere only when it holds no code', () => {
        // Given - synonyms under the specs, in the source with and without code, and inside places the walk never enters
        const root = packageWith({
            golden: 'a file, not a folder\n',
            'pkgs/inner/package.json': '{}\n',
            'pkgs/inner/snapshots/a.txt': 'x\n',
            'pkgs/package.json': '{}\n',
            'pkgs/snapshots/a.txt': 'x\n',
            'specs/api/__snapshots__/a.snap': 'x\n',
            'specs/api/__expected__/golden/a.txt': 'x\n',
            'specs/api/goldens/matcher.ts': 'export {};\n',
            'src/golden/a.txt': 'x\n',
            'src/goldens/a.txt': 'x\n',
            'src/goldens/matcher.ts': 'export {};\n',
            'src/node_modules/snapshots/a.txt': 'x\n',
        });

        // Then - each one named, from the member's label
        expect(checkNoSnapshotFolder(root, 'packages/app')).toStrictEqual([
            {
                fix: 'rename `snapshots/` to `__expected__/`, beside the test that reads it',
                found: '`snapshots/`, a synonym of `__expected__/`',
                line: 1,
                path: 'packages/app/pkgs/snapshots/',
                rule: 'no-snapshot-folder',
            },
            {
                fix: 'rename `__snapshots__/` to `__expected__/`, beside the test that reads it',
                found: '`__snapshots__/`, a synonym of `__expected__/`',
                line: 1,
                path: 'packages/app/specs/api/__snapshots__/',
                rule: 'no-snapshot-folder',
            },
            {
                fix: 'rename `goldens/` to `__expected__/`, beside the test that reads it',
                found: '`goldens/`, a synonym of `__expected__/`',
                line: 1,
                path: 'packages/app/specs/api/goldens/',
                rule: 'no-snapshot-folder',
            },
            {
                fix: 'rename `golden/` to `__expected__/`, beside the test that reads it',
                found: '`golden/`, a synonym of `__expected__/`',
                line: 1,
                path: 'packages/app/src/golden/',
                rule: 'no-snapshot-folder',
            },
        ]);
    });
});
