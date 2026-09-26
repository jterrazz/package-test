import { describe, expect, test } from 'vitest';

import { checkSourceRootHoldsKnownEntries } from './source-root-holds-known-entries.js';
import { located, ROOT, treeOf } from './source.fixtures.js';

describe('source-root-holds-known-entries', () => {
    test('source-root-holds-known-entries — the source root holds the two entries and the six trees, and nothing else', () => {
        // Given - the package's own tree, and one with a module and a folder left at its root
        const stray = treeOf({
            'src/index.ts': '',
            'src/kernel/pause.ts': '',
            'src/model/lesson.ts': '',
            'src/settings.ts': '',
        });

        // Then - the package holds none, and each stray entry is named at itself
        expect(checkSourceRootHoldsKnownEntries(ROOT)).toStrictEqual([]);
        expect(located(checkSourceRootHoldsKnownEntries(stray))).toStrictEqual([
            'src/model:1:1 source-root-holds-known-entries: the folder `src/model` at the source root, which holds the two entries and the six trees alone',
            'src/settings.ts:1:1 source-root-holds-known-entries: the file `src/settings.ts` at the source root, which holds the two entries and the six trees alone',
        ]);
    });
});
