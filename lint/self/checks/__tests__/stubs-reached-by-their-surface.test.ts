import { describe, expect, test } from 'vitest';

import { checkStubsReachedByTheirSurface } from '../stubs-reached-by-their-surface.js';
import { located, ROOT, treeOf } from './source.fixtures.js';

describe('checkStubsReachedByTheirSurface', () => {
    test('stubs-reached-by-their-surface — the stubs are entered by what they publish, a delivery by the specification that wires it', () => {
        // Given - the package's own tree, and one where a specification reaches the matching, another specification a delivery it does not wire, a third the intercept's input normaliser and the delivery port, and the chain an entry's channel pick
        const reaching = treeOf({
            'src/specifications/api/api.composition.ts': [
                "import { http } from '../../stubs/kinds/http.js';",
                "import { mswNode } from '../../stubs/delivery/same-process/msw-node.adapter.js';",
                "import { StubQueue } from '../../stubs/matching/stub-queue.js';",
                '',
            ].join('\n'),
            'src/specifications/cli/cli.composition.ts':
                "import { mswNode } from '../../stubs/delivery/same-process/msw-node.adapter.js';\n",
            'src/specifications/job/job.composition.ts': [
                "import { interceptCapability } from '../../stubs/intercept/intercept.capability.js';",
                "import { declared } from '../../stubs/intercept/declared.js';",
                "import type { InterceptPort } from '../../stubs/intercept/intercept.port.js';",
                '',
            ].join('\n'),
            'src/index.stubs.ts':
                "export { intercept } from './stubs/delivery/same-process/intercept.js';\n",
            'src/chain/arm.ts':
                "import { intercept } from '../stubs/delivery/same-process/intercept.js';\n",
            'src/stubs/delivery/same-process/msw-node.adapter.ts':
                "import type { InterceptPort } from '../../intercept/intercept.port.js';\n",
        });

        // Then - the package holds none; each reach below the surface is named at the import
        expect(checkStubsReachedByTheirSurface(ROOT)).toStrictEqual([]);
        expect(
            located(
                checkStubsReachedByTheirSurface(reaching, {
                    'delivery/same-process/msw-node.adapter.ts': [
                        'src/specifications/api/api.composition.ts',
                    ],
                }),
            ),
        ).toStrictEqual([
            'src/chain/arm.ts:1:1 stubs-reached-by-their-surface: `src/stubs/delivery/same-process/intercept.ts` is reached from outside the stubs, below their surface',
            'src/specifications/api/api.composition.ts:3:1 stubs-reached-by-their-surface: `src/stubs/matching/stub-queue.ts` is reached from outside the stubs, below their surface',
            'src/specifications/cli/cli.composition.ts:1:1 stubs-reached-by-their-surface: `src/stubs/delivery/same-process/msw-node.adapter.ts` is reached from outside the stubs, below their surface',
            'src/specifications/job/job.composition.ts:2:1 stubs-reached-by-their-surface: `src/stubs/intercept/declared.ts` is reached from outside the stubs, below their surface',
            'src/specifications/job/job.composition.ts:3:1 stubs-reached-by-their-surface: `src/stubs/intercept/intercept.port.ts` is reached from outside the stubs, below their surface',
        ]);
    });

    test('stubs-reached-by-their-surface — a declared delivery edge nobody takes is named in the lock', () => {
        // Given - a tree holding the lock, a table declaring two readers of the node delivery, and only one of them importing it
        const tree = treeOf({
            'src/specifications/api/api.composition.ts':
                "import { mswNode } from '../../stubs/delivery/same-process/msw-node.adapter.js';\n",
            'lint/self/checks/stubs-reached-by-their-surface.ts': '',
            'src/specifications/job/job.composition.ts': "export const job = 'no delivery';\n",
        });
        const readers = {
            'delivery/same-process/msw-node.adapter.ts': [
                'src/specifications/api/api.composition.ts',
                'src/specifications/job/job.composition.ts',
            ],
        };

        // Then - the unused row is a finding at the lock, the live one is none
        expect(located(checkStubsReachedByTheirSurface(tree, readers))).toStrictEqual([
            'lint/self/checks/stubs-reached-by-their-surface.ts:1:1 stubs-reached-by-their-surface: `DELIVERY_READERS` lets `src/specifications/job/job.composition.ts` reach `delivery/same-process/msw-node.adapter.ts`, an edge it no longer takes',
        ]);
    });

    test('stubs-reached-by-their-surface — a tree that does not hold the lock is not held to its table', () => {
        // Given - a project of its own, none of whose files the table names
        const tree = treeOf({ 'src/index.ts': "export const index = 'no stubs';\n" });

        // Then - its rows are this package's, and judge nothing there
        expect(checkStubsReachedByTheirSurface(tree)).toStrictEqual([]);
    });
});
