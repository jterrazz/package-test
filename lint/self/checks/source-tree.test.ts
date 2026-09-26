import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from './source-tree.fixtures.js';
import { checkFolderShape, checkSourceRoot } from './source-tree.js';

/** The self checker passes `source-root-holds-known-entries` (`source-root-holds-known-entries`) and `folder-named-for-a-concept` (`folder-named-for-a-concept`). */
describe('source-tree', () => {
    test('checker-source-tree — the shape of the source tree (self checker passes) — `source-root-holds-known-entries` — the source root holds the two entries and the six trees, and nothing else', () => {
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
            'src/model:1:1 source-root-holds-known-entries: the folder `src/model` at the source root, which holds the two entries and the six trees alone',
            'src/settings.ts:1:1 source-root-holds-known-entries: the file `src/settings.ts` at the source root, which holds the two entries and the six trees alone',
        ]);
    });

    test('checker-source-tree — the shape of the source tree (self checker passes) — `folder-named-for-a-concept` — a folder is named for a concept, holds two entries or more, and a facet root holds its face', () => {
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
            'src/facets/api/route.ts:1:1 folder-named-for-a-concept: `route.ts` sits at the root of the facet `api`, and is no file of its face',
            'src/kernel/core:1:1 folder-named-for-a-concept: the folder `core/` is named for a role, not a concept',
            'src/world/clock:1:1 folder-named-for-a-concept: the folder `clock/` holds one entry',
            'src/world/utils:1:1 folder-named-for-a-concept: the folder `utils/` is named for a role, not a concept',
        ]);
    });
});
