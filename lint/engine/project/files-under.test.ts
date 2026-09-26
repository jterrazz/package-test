import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { filesUnder } from './files-under.js';

describe('filesUnder', () => {
    test('lists every file at any depth, relative and sorted, and no directory', () => {
        // Given - a tree with a nested file, a file at the top and an empty folder
        const root = mkdtempSync(join(tmpdir(), 'files-under-'));
        mkdirSync(join(root, 'nested/empty'), { recursive: true });
        writeFileSync(join(root, 'nested/b.txt'), 'b');
        writeFileSync(join(root, 'a.txt'), 'a');

        // Then - the two files, from the root
        expect(filesUnder(root)).toStrictEqual(['a.txt', 'nested/b.txt']);
    });

    test('lists nothing under a folder that does not exist', () => {
        // Given - a path nothing was written at
        const missing = join(tmpdir(), 'files-under-missing', 'nowhere');

        // Then - no file, and no throw
        expect(filesUnder(missing)).toStrictEqual([]);
    });
});
