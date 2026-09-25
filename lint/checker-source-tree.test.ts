import { describe, expect, test } from 'vitest';

import { checkFolderShape, checkSourceRoot } from './checker-source-tree.js';
import { located, ROOT, treeOf } from './checker-source.fixtures.js';

/**
 * The self checker passes I9 (`i9-source-root`) and I12 (`i12-folder-shape`)
 * — what the source root holds, and what a folder of it may be named and hold.
 */
describe('the shape of the source tree (self checker passes I9, I12)', () => {
    test('i9 — the source root holds the two entries and the six trees, and nothing else', () => {
        // Given - the package's own tree, and one with a module and a folder left at its root
        const stray = treeOf({
            'src/index.ts': '',
            'src/kernel/pause.ts': '',
            'src/model/lesson.ts': '',
            'src/settings.ts': '',
        });

        // Then - the package holds none, and each stray entry is named at itself
        expect(checkSourceRoot(ROOT)).toStrictEqual([]);
        expect(located(checkSourceRoot(stray))).toStrictEqual([
            'src/model:1:1 i9-source-root: the folder `src/model` at the source root, which holds the two entries and the six trees alone',
            'src/settings.ts:1:1 i9-source-root: the file `src/settings.ts` at the source root, which holds the two entries and the six trees alone',
        ]);
    });

    test('i12 — a folder is named for a concept, holds two entries or more, and a facet root holds its face', () => {
        // Given - the package's own tree, and one with role folders, a lone file and a stray file at a facet's root
        const misshapen = treeOf({
            'src/facets/api/api.facet.ts': '',
            'src/facets/api/fixtures/one.json': '',
            'src/facets/api/request/request.action.test.ts': '',
            'src/facets/api/request/request.action.ts': '',
            'src/facets/api/route.ts': '',
            'src/facets/job/job.facet.ts': '',
            'src/facets/job/trigger.action.ts': '',
            'src/kernel/core/chain.ts': '',
            'src/kernel/core/state.ts': '',
            'src/kernel/pause.ts': '',
            'src/world/clock/clock.ts': '',
            'src/world/utils/format.test.ts': '',
            'src/world/utils/format.ts': '',
        });

        // Then - the package holds none; each misshapen folder or file is named at itself, the ground left alone
        expect(checkFolderShape(ROOT)).toStrictEqual([]);
        expect(located(checkFolderShape(misshapen))).toStrictEqual([
            'src/facets/api/route.ts:1:1 i12-folder-shape: `route.ts` sits at the root of the facet `api`, and is no file of its face',
            'src/kernel/core:1:1 i12-folder-shape: the folder `core/` is named for a role, not a concept',
            'src/world/clock:1:1 i12-folder-shape: the folder `clock/` holds one entry',
            'src/world/utils:1:1 i12-folder-shape: the folder `utils/` is named for a role, not a concept',
        ]);
    });
});
