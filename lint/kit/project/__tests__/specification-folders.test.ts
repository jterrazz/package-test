import { relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { specsTree } from '../../../__tests__/subject.fixtures.js';
import { walkFiles } from '../specification-folders.js';

describe('specification-folders', () => {
    test('the walk yields every file below, past the folders a tree prunes and the fixtures ground', () => {
        // Given - files at every depth, under node_modules and under __fixtures__
        const root = specsTree({
            'api/__fixtures__/seed.json': '{}\n',
            'api/node_modules/dep/index.js': '\n',
            'api/users/users.spec.ts': '\n',
            'top.ts': '\n',
        });

        // Then - the files outside the pruned folders, and only them
        expect([...walkFiles(root)].map((path) => relative(root, path)).toSorted()).toStrictEqual([
            'api/users/users.spec.ts',
            'top.ts',
        ]);
    });
});
