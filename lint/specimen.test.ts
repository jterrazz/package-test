import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { forgetTree } from '../src/seams/git/tree.js';
import { specimenOf } from './specimen.js';

/** A specs tree on disk, from its files. Returns the specs root. */
function specsTree(files: Record<string, string>): string {
    const scratch = mkdtempSync(join(tmpdir(), 'specimen-'));
    const root = join(scratch, 'specs');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    forgetTree();
    return root;
}

const SPEC = "import { api } from '../api.specification.js';\n";

describe('specimen', () => {
    test.each([
        ['an app module', "import { createApp } from '../shared/fixtures/specimen-api/app.js';"],
        ['a root', "specification.api({ root: '../shared/fixtures/specimen-api' });"],
        [
            'a binary',
            "const BIN = resolve(import.meta.dirname, '../shared/fixtures/specimen-api/cli.sh');",
        ],
    ])(
        'a runner whose specification module names the shared fixtures by %s drives a specimen',
        (_, door) => {
            // Given - a spec importing that runner
            const root = specsTree({
                'api/api.specification.ts': door,
                'api/seed/nominal.spec.ts': SPEC,
            });

            // Then - the specimen, by its folder
            expect(specimenOf(join(root, 'api/seed/nominal.spec.ts'), SPEC)).toBe('specimen-api');
        },
    );

    test('a runner built on another runner drives the specimen that one does', () => {
        // Given - a runner reading the url of one that serves a specimen
        const root = specsTree({
            'website/deployed.specification.ts':
                "import { url } from './website.specification.js';",
            'website/website.specification.ts':
                "const command = 'node specs/shared/fixtures/specimen-website/server.mjs';",
        });
        const spec = "import { website } from '../deployed.specification.js';\n";

        // Then - the specimen of the runner it was built on
        expect(specimenOf(join(root, 'website/visit/page.spec.ts'), spec)).toBe('specimen-website');
    });

    test('the project’s own app, and the shared fixtures named only in a comment, are no specimen', () => {
        // Given - a runner starting the project's app, a comment naming a fixture
        const root = specsTree({
            'api/api.specification.ts':
                "// the app, not specs/shared/fixtures/app\nimport { app } from '../../src/app.js';",
        });

        // Then - nothing
        expect(specimenOf(join(root, 'api/events/list/listing.spec.ts'), SPEC)).toBeUndefined();
    });
});
