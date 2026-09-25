import { describe, expect, test } from 'vitest';

import { checkEngineOwner, checkFacetIsolation } from './checker-source-imports.js';
import { located, ROOT, treeOf } from './checker-source.fixtures.js';

/**
 * The self checker passes I10 (`i10-facet-isolation`) and I11
 * (`i11-engine-owner`) — what the modules of the source tree may import,
 * beyond the direction I1 holds between its layers.
 */
describe('checker-source-imports', () => {
    test('the imports of the source tree (self checker passes I10, I11) — i10 — a facet never imports another, and is entered from outside by its face', () => {
        // Given - the package's own tree, and one where a facet reaches another, and an entry skips the face for a root file and for a concept folder
        const crossing = treeOf({
            'src/facets/api/api.handle.ts': "\nimport type { X } from '../cli/cli.handle.js';\n",
            'src/facets/cli/cli.handle.ts': 'export type X = 1;\n',
            'src/facets/cli/process/cli.port.ts': 'export type Y = 1;\n',
            'src/index.ts':
                "export type { X } from './facets/cli/cli.handle.js';\nexport type { Y } from './facets/cli/process/cli.port.js';\n",
        });

        // Then - the package holds none; the facet's import and each reach past the face are named at the import
        expect(checkFacetIsolation(ROOT)).toStrictEqual([]);
        expect(located(checkFacetIsolation(crossing))).toStrictEqual([
            'src/facets/api/api.handle.ts:2:1 i10-facet-isolation: the facet `api` imports `src/facets/cli/cli.handle.ts`, a module of the facet `cli`',
            'src/index.ts:1:1 i10-facet-isolation: `src/facets/cli/cli.handle.ts` is reached from outside the facet `cli` by a module its face does not serve',
            'src/index.ts:2:1 i10-facet-isolation: `src/facets/cli/process/cli.port.ts` is reached inside the facet `cli`, below its root files',
        ]);
    });

    test('the imports of the source tree (self checker passes I10, I11) — i11 — each third-party engine is imported by the one slice that owns it', () => {
        // Given - the package's own tree, and one where the kernel reaches for pg and the api facet for playwright
        const misplaced = treeOf({
            'src/facets/api/api.handle.ts':
                "export async function open() {\n    return import('playwright');\n}\n",
            'src/kernel/chain/state.ts': "import type { Pool } from 'pg';\n",
            'src/world/services/postgres/postgres.adapter.ts': "import pg from 'pg';\n",
        });

        // Then - the package holds none; each import outside its owner is named at the import, with the owner
        expect(checkEngineOwner(ROOT)).toStrictEqual([]);
        expect(located(checkEngineOwner(misplaced))).toStrictEqual([
            'src/facets/api/api.handle.ts:2:12 i11-engine-owner: `playwright` is imported outside `src/facets/website/`, the one slice that owns it',
            'src/kernel/chain/state.ts:1:1 i11-engine-owner: `pg` is imported outside `src/world/services/postgres/`, the one slice that owns it',
        ]);
    });
});
