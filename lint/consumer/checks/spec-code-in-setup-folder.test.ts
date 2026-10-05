import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkSpecCodeInSetupFolder } from './spec-code-in-setup-folder.js';

function treeOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'setup-target-'));
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    return root;
}

describe('checkSpecCodeInSetupFolder', () => {
    test('sends a loose helper to the _setup/ of the lowest folder its importers share', () => {
        // Given - a helper beside orders that users alone imports, and one both leaves import
        const root = treeOf({
            'specs/cli/orders/format.ts': "export const FORMAT = 'table';\n",
            'specs/cli/orders/listing.spec.ts': "import { NOW } from './clock.js';\n",
            'specs/cli/orders/clock.ts': "export const NOW = 'now';\n",
            'specs/cli/users/listing.spec.ts':
                "import { FORMAT } from '../orders/format.js';\nimport { NOW } from '../orders/clock.js';\n",
        });

        // Then - each fix names the _setup/ its importers share, not the one beside the file
        const fixes = checkSpecCodeInSetupFolder(root).map(({ fix, path }) => [path, fix]);
        expect(fixes).toStrictEqual([
            [
                'specs/cli/orders/clock.ts',
                expect.stringContaining('move it to `specs/cli/_setup/clock.ts`'),
            ],
            [
                'specs/cli/orders/format.ts',
                expect.stringContaining('move it to `specs/cli/users/_setup/format.ts`'),
            ],
        ]);
    });

    test('names each loose helper and each fixtures module, from the subject it serves, and leaves what is no such code', () => {
        // Given - helpers no spec imports, deep under a leaf and under a specification with no spec, a fixtures module loose and one in a _setup, and code that is no loose helper
        const found = checkSpecCodeInSetupFolder(
            treeOf({
                'specs/api/_setup/data.fixtures.ts': 'export {};\n',
                'specs/data.fixtures.ts': 'export {};\n',
                'specs/api/_setup/runner.ts': 'export {};\n',
                'specs/api/api.specification.ts': 'export {};\n',
                'specs/api/fixtures/x.ts': 'export {};\n',
                'specs/api/orders/data.fixtures.ts': 'export {};\n',
                'specs/api/orders/deep/helper.ts': 'export {};\n',
                'specs/api/orders/list.spec.ts': 'test();\n',
                'specs/api/orders/util.mjs': 'export {};\n',
                'specs/api/orders/util.test.tsx': 'test();\n',
                'specs/api/orders/widget.tsx': 'export {};\n',
                'specs/api/orders/widget.test.tsx': 'test();\n',
                'specs/helper.ts': 'export {};\n',
                'specs/web/a/b/helper.ts': 'export {};\n',
            }),
        ).map(
            ({ fix, found: what, line, path, rule }) =>
                `${path}:${line} ${what} — ${fix} (${rule})`,
        );

        // Then - each one, with its home
        expect(found).toStrictEqual([
            'specs/api/_setup/data.fixtures.ts:1 `data.fixtures.ts` under specs/: a fixture is input data, a file in `_fixtures/`, never a module — name the module for what it holds and move it into the `_setup/` of the lowest folder its readers share — `specs/api/_setup/<meaning>.ts` — and the paths that import it (spec-code-in-setup-folder)',
            'specs/api/orders/data.fixtures.ts:1 `data.fixtures.ts` under specs/: a fixture is input data, a file in `_fixtures/`, never a module — name the module for what it holds and move it into the `_setup/` of the lowest folder its readers share — `specs/api/orders/_setup/<meaning>.ts` — and the paths that import it (spec-code-in-setup-folder)',
            'specs/api/orders/deep/helper.ts:1 `helper.ts`, code that prepares specs outside every `_setup/` — move it to `specs/api/orders/_setup/deep/helper.ts` — the `_setup/` of the lowest folder its readers share — and the paths that import it (spec-code-in-setup-folder)',
            'specs/data.fixtures.ts:1 `data.fixtures.ts` under specs/: a fixture is input data, a file in `_fixtures/`, never a module — name the module for what it holds and move it into the `_setup/` of the lowest folder its readers share — `specs/_shared/_setup/<meaning>.ts` — and the paths that import it (spec-code-in-setup-folder)',
            'specs/web/a/b/helper.ts:1 `helper.ts`, code that prepares specs outside every `_setup/` — move it to `specs/web/_setup/a/b/helper.ts` — the `_setup/` of the lowest folder its readers share — and the paths that import it (spec-code-in-setup-folder)',
        ]);
    });
});
