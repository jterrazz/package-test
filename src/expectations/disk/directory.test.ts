import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../tokens/capture-scope.js';
import { diffDirectories, DirectoryAccessor, walkDirectory } from './directory.js';

/** A tree holding the given files, each written with its parent folders. */
function treeOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'directory-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

describe('directory', () => {
    test('walkDirectory — every file under the root by its path from it, sorted as text, the usual folders and the named ones left out, a missing root holding none', async () => {
        // Given - a tree of nested files beside folders a project keeps out, and a name asked to be ignored
        const root = treeOf({
            '.DS_Store': 'x',
            '.cache/x': 'x',
            '.git/HEAD': 'x',
            '.next/x': 'x',
            '.turbo/x': 'x',
            'a.txt': 'a',
            'a/b.txt': 'b',
            'a/deep/c.txt': 'c',
            'dist/out.js': 'x',
            'node_modules/pkg/index.js': 'x',
            'skip/me.txt': 'x',
        });

        // Then - the files kept, in text order, and none for a root that does not exist
        expect([
            await walkDirectory(root, { ignore: ['skip'] }),
            await new DirectoryAccessor(root, root).files(),
            await walkDirectory(join(root, 'missing')),
        ]).toStrictEqual([
            ['a.txt', 'a/b.txt', 'a/deep/c.txt'],
            ['a.txt', 'a/b.txt', 'a/deep/c.txt', 'skip/me.txt'],
            [],
        ]);
    });

    test('diffDirectories — the files only the actual tree holds, those only the expected holds, and those whose text differs, tokens read and captures shared', async () => {
        // Given - an expected tree with a token, a capture and a file the actual lacks, and an actual tree with a file more
        const expected = treeOf({
            'gone.txt': 'x',
            'id.txt': 'id {{uuid#id}}',
            'same.txt': 'v {{int}}',
            'text.txt': 'old',
        });
        const actual = treeOf({
            'id.txt': 'id 3f2504e0-4f89-41d3-9a0c-0305e82c3301',
            'new.txt': 'x',
            'same.txt': 'v 7',
            'text.txt': 'new',
        });
        const scope = new CaptureScope();

        // When - they are compared
        const diff = await diffDirectories(expected, actual, { scope });

        // Then - each difference, and the capture bound in the scope handed
        expect([diff, scope.get('id')]).toStrictEqual([
            {
                added: ['new.txt'],
                changed: [{ actual: 'new', expected: 'old', path: 'text.txt' }],
                removed: ['gone.txt'],
            },
            '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        ]);
    });
});
