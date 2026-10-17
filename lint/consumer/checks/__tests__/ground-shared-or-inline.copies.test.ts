import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { sourceCopiedBy } from '../ground-shared-or-inline.copies.js';

describe('sourceCopiedBy', () => {
    test("names a file of the repository that holds exactly the golden's bytes, and none when the bytes differ in a character or in length", () => {
        // Given - a golden, a source holding the same bytes, a file of the same length with one character changed, and a longer file
        const root = packageWith({
            'docs/same.md': '# Page\n',
            'docs/shorter.md': '# Pag\n',
            'docs/typo.md': '# Pagf\n',
            'specs/api/__expected__/page.md': '# Page\n',
        });
        const golden = join(root, 'specs/api/__expected__/page.md');

        // Then - only the identical file is named, and the golden itself is not its own copy
        expect([
            sourceCopiedBy(root, golden),
            sourceCopiedBy(root, join(root, 'docs/typo.md')),
        ]).toStrictEqual([join(root, 'docs/same.md'), undefined]);
    });
});
