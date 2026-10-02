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
});
