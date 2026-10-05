import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from '../../kit/testing/source.fixtures.js';
import { checkFolderNamedForAConcept } from './folder-named-for-a-concept.js';

describe('checkFolderNamedForAConcept', () => {
    test('folder-named-for-a-concept — a folder is named for a concept, holds two entries or more, and a specification root holds its face', () => {
        // Given - the package's own tree, and one with role folders, a lone file and a stray file at a specification's root
        const misshapen = treeOf({
            'src/specifications/api/api.composition.ts': '',
            'src/specifications/api/_fixtures/one.json': '',
            'src/specifications/api/request/request.action.test.ts': '',
            'src/specifications/api/request/request.action.ts': '',
            'src/specifications/api/route.ts': '',
            'src/specifications/job/job.composition.ts': '',
            'src/specifications/job/trigger.action.ts': '',
            'src/chain/core/chain.ts': '',
            'src/chain/core/state.ts': '',
            'src/chain/pause.ts': '',
            'src/clock/clock.ts': '',
            'src/stubs/stub.ts': '',
            'src/stubs/utils/format.test.ts': '',
            'src/stubs/utils/format.ts': '',
        });

        // Then - the package holds none; each misshapen folder or file is named at itself, the ground left alone
        expect(checkFolderNamedForAConcept(ROOT)).toStrictEqual([]);
        expect(located(checkFolderNamedForAConcept(misshapen))).toStrictEqual([
            'src/chain/core:1:1 folder-named-for-a-concept: the folder `core/` is named for a role, not a concept',
            'src/clock:1:1 folder-named-for-a-concept: the folder `clock/` holds one entry',
            'src/specifications/api/route.ts:1:1 folder-named-for-a-concept: `route.ts` sits at the root of the specification `api`, and is no file of its face',
            'src/stubs/utils:1:1 folder-named-for-a-concept: the folder `utils/` is named for a role, not a concept',
        ]);
    });
});
