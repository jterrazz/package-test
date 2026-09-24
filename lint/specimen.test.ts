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
        [
            'the root its server command runs from',
            "specification.website({ root: '../shared/fixtures/specimen-api', server: { command: 'node server.mjs' } });",
        ],
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
            expect(specimenOf(join(root, 'api/seed/nominal.spec.ts'), SPEC, 'api')).toBe(
                'specimen-api',
            );
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
        expect(specimenOf(join(root, 'website/visit/page.spec.ts'), spec, 'website')).toBe(
            'specimen-website',
        );
    });

    test('the project’s own app, and the shared fixtures named only in a comment, are no specimen', () => {
        // Given - a runner starting the project's app, a comment naming a fixture
        const root = specsTree({
            'api/api.specification.ts':
                "// the app, not specs/shared/fixtures/app\nimport { app } from '../../src/app.js';",
        });

        // Then - nothing
        expect(
            specimenOf(join(root, 'api/events/list/listing.spec.ts'), SPEC, 'api'),
        ).toBeUndefined();
    });

    test('the root a runner reads its services’ ground from is no app', () => {
        // Given - an integration runner whose root holds only the database's init scripts
        const root = specsTree({
            'integration/integration.specification.ts':
                "specification.integration({ root: '../shared/fixtures/specimen-api', services: { db: postgres() } });",
        });
        const spec = "import { integration } from '../integration.specification.js';\n";

        // Then - no specimen reached
        expect(
            specimenOf(join(root, 'integration/services/redis.spec.ts'), spec, 'integration'),
        ).toBeUndefined();
    });

    test('a spec building its runner inline drives the specimen it names', () => {
        // Given - a spec that starts its own runner over a broken tree of the shared fixtures
        const spec =
            "const BROKEN = resolve(import.meta.dirname, '../../shared/fixtures/broken-init');\nawait specification.api({ root: BROKEN, server: () => app });\n";
        const root = specsTree({ 'api/services/refusals.spec.ts': spec });

        // Then - the tree it names
        expect(specimenOf(join(root, 'api/services/refusals.spec.ts'), spec, 'api')).toBe(
            'broken-init',
        );
    });

    test('an integration spec reaches the module of the shared fixtures its chains call', () => {
        // Given - a spec importing a module of the shared fixtures, under integration and under api
        const spec =
            "import { listOrders } from '../../shared/fixtures/orders/orders.js';\nimport { integration } from '../pure.specification.js';\n";
        const root = specsTree({
            'integration/pure.specification.ts': '',
            'api/api.specification.ts': '',
        });

        // Then - the module is integration's subject, and an api spec's helper
        expect([
            specimenOf(join(root, 'integration/call/orders.spec.ts'), spec, 'integration'),
            specimenOf(join(root, 'api/seed/orders.spec.ts'), spec, 'api'),
        ]).toStrictEqual(['orders', undefined]);
    });
});
