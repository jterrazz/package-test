import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { checkNoCrossFacetImport } from './no-cross-facet-import.js';

describe('checkNoCrossFacetImport', () => {
    test('no-cross-facet-import — a facet never imports another, and is entered from outside by its face', () => {
        // Given - the package's own tree, and one where a facet reaches another, and an entry skips the face for a root file and for a concept folder
        const crossing = treeOf({
            'src/facets/api/api.handle.ts': "\nimport type { X } from '../cli/cli.handle.js';\n",
            'src/facets/cli/cli.handle.ts': 'export type X = 1;\n',
            'src/facets/cli/process/cli.port.ts': 'export type Y = 1;\n',
            'src/index.ts':
                "export type { X } from './facets/cli/cli.handle.js';\nexport type { Y } from './facets/cli/process/cli.port.js';\n",
        });

        // Then - the package holds none; the facet's import and each reach past the face are named at the import
        expect(checkNoCrossFacetImport(ROOT)).toStrictEqual([]);
        expect(located(checkNoCrossFacetImport(crossing))).toStrictEqual([
            'src/facets/api/api.handle.ts:2:1 no-cross-facet-import: the facet `api` imports `src/facets/cli/cli.handle.ts`, a module of the facet `cli`',
            'src/index.ts:1:1 no-cross-facet-import: `src/facets/cli/cli.handle.ts` is reached from outside the facet `cli` by a module its face does not serve',
            'src/index.ts:2:1 no-cross-facet-import: `src/facets/cli/process/cli.port.ts` is reached inside the facet `cli`, below its root files',
        ]);
    });
});
