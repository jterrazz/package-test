import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { checkStubsReachedByTheirSurface } from './stubs-reached-by-their-surface.js';

describe('checkStubsReachedByTheirSurface', () => {
    test('stubs-reached-by-their-surface — the stubs are entered by what they publish, a delivery by the facet that wires it', () => {
        // Given - the package's own tree, and one where a facet reaches the matching, another facet a delivery it does not wire, a third the intercept's input normaliser and the delivery port, and the kernel an entry's channel pick
        const reaching = treeOf({
            'src/facets/api/api.facet.ts': [
                "import { http } from '../../world/stubs/kinds/http.js';",
                "import { mswNode } from '../../world/stubs/delivery/same-process/msw-node.adapter.js';",
                "import { StubQueue } from '../../world/stubs/matching/stub-queue.js';",
                '',
            ].join('\n'),
            'src/facets/cli/cli.facet.ts':
                "import { mswNode } from '../../world/stubs/delivery/same-process/msw-node.adapter.js';\n",
            'src/facets/job/job.facet.ts': [
                "import { interceptCapability } from '../../world/stubs/intercept/intercept.capability.js';",
                "import { declared } from '../../world/stubs/intercept/declared.js';",
                "import type { InterceptPort } from '../../world/stubs/intercept/intercept.port.js';",
                '',
            ].join('\n'),
            'src/index.ts':
                "export { intercept } from './world/stubs/delivery/same-process/intercept.js';\n",
            'src/kernel/chain/arm.ts':
                "import { intercept } from '../../world/stubs/delivery/same-process/intercept.js';\n",
            'src/world/stubs/delivery/same-process/msw-node.adapter.ts':
                "import type { InterceptPort } from '../../intercept/intercept.port.js';\n",
        });

        // Then - the package holds none; each reach below the surface is named at the import
        expect(checkStubsReachedByTheirSurface(ROOT)).toStrictEqual([]);
        expect(
            located(
                checkStubsReachedByTheirSurface(reaching, {
                    'delivery/same-process/msw-node.adapter.ts': ['src/facets/api/api.facet.ts'],
                }),
            ),
        ).toStrictEqual([
            'src/facets/api/api.facet.ts:3:1 stubs-reached-by-their-surface: `src/world/stubs/matching/stub-queue.ts` is reached from outside the stubs, below their surface',
            'src/facets/cli/cli.facet.ts:1:1 stubs-reached-by-their-surface: `src/world/stubs/delivery/same-process/msw-node.adapter.ts` is reached from outside the stubs, below their surface',
            'src/facets/job/job.facet.ts:2:1 stubs-reached-by-their-surface: `src/world/stubs/intercept/declared.ts` is reached from outside the stubs, below their surface',
            'src/facets/job/job.facet.ts:3:1 stubs-reached-by-their-surface: `src/world/stubs/intercept/intercept.port.ts` is reached from outside the stubs, below their surface',
            'src/kernel/chain/arm.ts:1:1 stubs-reached-by-their-surface: `src/world/stubs/delivery/same-process/intercept.ts` is reached from outside the stubs, below their surface',
        ]);
    });

    test('stubs-reached-by-their-surface — a declared delivery edge nobody takes is named in the lock', () => {
        // Given - a tree holding the lock, a table declaring two readers of the node delivery, and only one of them importing it
        const tree = treeOf({
            'src/facets/api/api.facet.ts':
                "import { mswNode } from '../../world/stubs/delivery/same-process/msw-node.adapter.js';\n",
            'lint/self/checks/stubs-reached-by-their-surface.ts': '',
            'src/facets/job/job.facet.ts': "export const job = 'no delivery';\n",
        });
        const readers = {
            'delivery/same-process/msw-node.adapter.ts': [
                'src/facets/api/api.facet.ts',
                'src/facets/job/job.facet.ts',
            ],
        };

        // Then - the unused row is a finding at the lock, the live one is none
        expect(located(checkStubsReachedByTheirSurface(tree, readers))).toStrictEqual([
            'lint/self/checks/stubs-reached-by-their-surface.ts:1:1 stubs-reached-by-their-surface: `DELIVERY_READERS` lets `src/facets/job/job.facet.ts` reach `delivery/same-process/msw-node.adapter.ts`, an edge it no longer takes',
        ]);
    });

    test('stubs-reached-by-their-surface — a tree that does not hold the lock is not held to its table', () => {
        // Given - a project of its own, none of whose files the table names
        const tree = treeOf({ 'src/index.ts': "export const index = 'no stubs';\n" });

        // Then - its rows are this package's, and judge nothing there
        expect(checkStubsReachedByTheirSurface(tree)).toStrictEqual([]);
    });
});
