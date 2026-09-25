import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { facetCrossings, misplacedEngines, misshapenFolders, strayRootEntries } from './tree.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

/** A throwaway repository holding the files given, by path. */
function treeOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'tree-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    mkdirSync(join(root, 'lint'), { recursive: true });
    return root;
}

/**
 * Meta-tests I9 (`i9-source-root`), I10 (`i10-facet-isolation`), I11
 * (`i11-engine-owner`) and I12 (`i12-folder-shape`) — the shape of `src/`
 * beyond the direction I1 holds between its layers.
 */
describe('the shape of the source tree (meta-tests I9 to I12)', () => {
    test('i9 — the source root holds the two entries and the six trees, and nothing else', () => {
        // Given - the package's own tree, and one with a module left at its root
        const stray = treeOf({
            'src/index.ts': '',
            'src/settings.ts': '',
            'src/kernel/pause.ts': '',
        });

        // Then - the package holds none, and the stray module is named
        expect(strayRootEntries(ROOT)).toStrictEqual([]);
        expect(strayRootEntries(stray)).toStrictEqual([
            'src/settings.ts is no entry of the source root',
        ]);
    });

    test('i10 — a facet never imports another, and is entered from outside by its root files', () => {
        // Given - the package's own tree, and one where a facet reaches another and an entry reaches a concept folder
        const crossing = treeOf({
            'src/facets/api/api.handle.ts': "import type { X } from '../cli/cli.handle.js';\n",
            'src/facets/cli/cli.handle.ts': 'export type X = 1;\n',
            'src/facets/cli/process/cli.port.ts': 'export type Y = 1;\n',
            'src/index.ts':
                "export type { X } from './facets/cli/cli.handle.js';\nexport type { Y } from './facets/cli/process/cli.port.js';\n",
        });

        // Then - the package holds none; the facet's import and the entry's reach below the face are each named
        expect(facetCrossings(ROOT)).toStrictEqual([]);
        expect(facetCrossings(crossing)).toStrictEqual([
            'src/facets/api/api.handle.ts imports src/facets/cli/cli.handle.ts: a facet never imports another',
            'src/index.ts imports src/facets/cli/process/cli.port.ts: a facet is entered by its root files',
        ]);
    });

    test('i11 — each third-party engine is imported by the one slice that owns it', () => {
        // Given - the package's own tree, and one where the kernel reaches for pg and the api facet for playwright
        const misplaced = treeOf({
            'src/facets/api/api.handle.ts': "const browser = await import('playwright');\n",
            'src/kernel/chain/state.ts': "import type { Pool } from 'pg';\n",
            'src/world/services/postgres/postgres.adapter.ts': "import pg from 'pg';\n",
        });

        // Then - the package holds none; each import outside its owner is named with the owner
        expect(misplacedEngines(ROOT)).toStrictEqual([]);
        expect(misplacedEngines(misplaced)).toStrictEqual([
            'src/facets/api/api.handle.ts imports playwright, which only src/facets/website/ imports',
            'src/kernel/chain/state.ts imports pg, which only src/world/services/postgres/ imports',
        ]);
    });

    test('i12 — a folder is named for a concept, holds two entries or more, and a facet root holds its face', () => {
        // Given - the package's own tree, and one with a role folder, a lone file and a stray file at a facet's root
        const misshapen = treeOf({
            'src/facets/api/api.facet.ts': '',
            'src/facets/api/fixtures/one.json': '',
            'src/facets/api/request/request.action.ts': '',
            'src/facets/api/request/request.action.test.ts': '',
            'src/facets/api/route.ts': '',
            'src/facets/job/job.facet.ts': '',
            'src/facets/job/trigger.action.ts': '',
            'src/world/clock/clock.ts': '',
            'src/world/utils/format.ts': '',
            'src/world/utils/format.test.ts': '',
        });

        // Then - the package holds none; each misshapen folder or file is named, the ground left alone
        expect(misshapenFolders(ROOT)).toStrictEqual([]);
        expect(misshapenFolders(misshapen)).toStrictEqual([
            "src/facets/api/route.ts is no file of the facet's face: it belongs in a concept folder",
            'src/world/clock holds 1 entry: sit it at its parent',
            'src/world/utils is named for a role, not a concept',
        ]);
    });
});
