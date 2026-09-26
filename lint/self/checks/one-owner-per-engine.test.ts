import { describe, expect, test } from 'vitest';

import { checkOneOwnerPerEngine } from './one-owner-per-engine.js';
import { located, ROOT, treeOf } from './source.fixtures.js';

describe('checkOneOwnerPerEngine', () => {
    test('one-owner-per-engine — each third-party engine is imported by the one slice that owns it', () => {
        // Given - the package's own tree, and one where the kernel reaches for pg and the api facet for playwright
        const misplaced = treeOf({
            'src/facets/api/api.handle.ts':
                "export async function open() {\n    return import('playwright');\n}\n",
            'src/kernel/chain/state.ts': "import type { Pool } from 'pg';\n",
            'src/world/services/postgres/postgres.adapter.ts': "import pg from 'pg';\n",
        });

        // Then - the package holds none; each import outside its owner is named at the import, with the owner
        expect(checkOneOwnerPerEngine(ROOT)).toStrictEqual([]);
        expect(located(checkOneOwnerPerEngine(misplaced))).toStrictEqual([
            'src/facets/api/api.handle.ts:2:12 one-owner-per-engine: `playwright` is imported outside `src/facets/website/`, the one slice that owns it',
            'src/kernel/chain/state.ts:1:1 one-owner-per-engine: `pg` is imported outside `src/world/services/postgres/`, the one slice that owns it',
        ]);
    });
});
