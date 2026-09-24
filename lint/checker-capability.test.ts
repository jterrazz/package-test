import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { forgetTree } from '../src/seams/git/tree.js';
import { checkCapabilityFolder } from './checker-capability.js';

/** A specs tree on disk, from its files. Returns the specs root. */
function specsTree(files: Record<string, string>): string {
    const scratch = mkdtempSync(join(tmpdir(), 'checker-capability-'));
    const root = join(scratch, 'specs');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    forgetTree();
    return root;
}

const SPECIMEN = "import { createApp } from '../shared/fixtures/specimen-api/app.js';\n";

/** A spec at `depth` folders below the facet, importing the facet's runner. */
function spec(depth: number): string {
    return `import { api } from '${'../'.repeat(depth)}api.specification.js';\n`;
}

describe('c35 — a spec of a specimen is filed by its capability', () => {
    test('a spec of a specimen filed by its route, or under no capability, is refused', () => {
        // Given - three specs of a specimen: by route, under a grab-bag, one folder too deep
        const root = specsTree({
            'api/api.specification.ts': SPECIMEN,
            'api/users/list/listing.spec.ts': spec(2),
            'api/assertions/whole.spec.ts': spec(1),
            'api/seed/nominal/nominal.spec.ts': spec(2),
        });

        // Then - each, at its first line
        expect(
            checkCapabilityFolder(root).map(({ file, found }) => `${file} ${found}`),
        ).toStrictEqual([
            'api/assertions/whole.spec.ts a spec of the specimen `shared/fixtures/specimen-api`, filed under `api/assertions/`',
            'api/seed/nominal/nominal.spec.ts a spec of the specimen `shared/fixtures/specimen-api`, filed under `api/seed/nominal/`',
            'api/users/list/listing.spec.ts a spec of the specimen `shared/fixtures/specimen-api`, filed under `api/users/list/`',
        ]);
    });

    test('a capability folder passes, and a spec of the project’s own app is C30’s', () => {
        // Given - a specimen spec under seed/, and a project whose runner starts its own app
        const specimen = specsTree({
            'api/api.specification.ts': SPECIMEN,
            'api/seed/nominal.spec.ts': spec(1),
        });
        const product = specsTree({
            'api/api.specification.ts': "import { app } from '../../src/app.js';\n",
            'api/users/list/listing.spec.ts': spec(2),
        });

        // Then - no finding in either
        expect([
            ...checkCapabilityFolder(specimen),
            ...checkCapabilityFolder(product),
        ]).toStrictEqual([]);
    });

    test('a reasoned suppression above the first line of code keeps a spec where it is', () => {
        // Given - a spec of a specimen by its route, silenced above its first import
        const root = specsTree({
            'api/api.specification.ts': SPECIMEN,
            'api/users/list/listing.spec.ts': `// checker-disable-next-line c35 -- a document names this path\n${spec(2)}`,
            'api/users/get/reading.spec.ts': `/** A doc comment. */\n${spec(2)}`,
        });

        // Then - the silenced file passes, and the other is reported at its first line of code
        expect(
            checkCapabilityFolder(root).map(({ file, line }) => `${file}:${line}`),
        ).toStrictEqual(['api/users/get/reading.spec.ts:2']);
    });
});
