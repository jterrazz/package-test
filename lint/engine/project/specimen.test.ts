import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { forgetTree } from './git-tree.js';
import { specimenOf } from './specimen.js';

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

describe('specimenOf', () => {
    test.each([
        ['an app module', "import { createApp } from '../_shared/_fixtures/specimen-api/app.js';"],
        [
            'the root its server command runs from',
            "specification.website({ root: '../_shared/_fixtures/specimen-api', server: { command: 'node server.mjs' } });",
        ],
        [
            'a binary',
            "const BIN = resolve(import.meta.dirname, '../_shared/_fixtures/specimen-api/cli.sh');",
        ],
    ])(
        'specimen — a runner whose specification module names the shared fixtures by %s drives a specimen',
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

    test('specimen — a runner built on another runner drives the specimen that one does', () => {
        // Given - a runner reading the url of one that serves a specimen
        const root = specsTree({
            'website/deployed.specification.ts':
                "import { url } from './website.specification.js';",
            'website/website.specification.ts':
                "const command = 'node specs/website/_fixtures/specimen-website/server.mjs';",
        });
        const spec = "import { website } from '../deployed.specification.js';\n";

        // Then - the specimen of the runner it was built on
        expect(specimenOf(join(root, 'website/visit/page.spec.ts'), spec, 'website')).toBe(
            'specimen-website',
        );
    });

    test('specimen — the project’s own app, and the shared fixtures named only in a comment, are no specimen', () => {
        // Given - a runner starting the project's app, a comment naming a fixture
        const root = specsTree({
            'api/api.specification.ts':
                "// the app, not specs/_shared/_fixtures/app\nimport { app } from '../../src/app.js';",
        });

        // Then - nothing
        expect(
            specimenOf(join(root, 'api/events/list/listing.spec.ts'), SPEC, 'api'),
        ).toBeUndefined();
    });

    test.each([
        [
            'written inline',
            "specification.integration({ root: '../_shared/_fixtures/specimen-api', services: { db: postgres() } });",
        ],
        [
            'hoisted into a const',
            "const ROOT = '../_shared/_fixtures/specimen-api';\nspecification.integration({ root: ROOT, services });",
        ],
        [
            'beside a service that runs a command',
            "specification.integration({ root: '../_shared/_fixtures/specimen-api', services: { worker: process({ command: 'node w.mjs' }) } });",
        ],
        [
            'under an app handed in, not started',
            "const BROKEN = resolve(import.meta.dirname, '../_shared/_fixtures/broken-init');\nspecification.api({ root: BROKEN, server: () => app });",
        ],
    ])('specimen — the root a runner reads its services’ ground from is no app, %s', (_, door) => {
        // Given - a runner whose root holds only its services' ground
        const root = specsTree({ 'integration/integration.specification.ts': door });
        const spec = "import { integration } from '../integration.specification.js';\n";

        // Then - no specimen reached
        expect(
            specimenOf(join(root, 'integration/services/redis.spec.ts'), spec, 'integration'),
        ).toBeUndefined();
    });

    test.each([
        [
            'written inline',
            "specification.website({ root: './_fixtures/specimen-website', server: { command: 'node server.mjs' } });",
        ],
        [
            'hoisted into a const',
            "const SITE = resolve(import.meta.dirname, './_fixtures/specimen-website');\nspecification.website({ root: SITE, server: { command: 'node server.mjs' } });",
        ],
    ])('specimen — the root a server command runs from is the app, %s', (_, door) => {
        // Given - a runner whose server command runs from a specimen's folder
        const root = specsTree({ 'website/website.specification.ts': door });
        const spec = "import { website } from '../website.specification.js';\n";

        // Then - the specimen, by its folder
        expect(specimenOf(join(root, 'website/visit/page.spec.ts'), spec, 'website')).toBe(
            'specimen-website',
        );
    });

    test('specimen — a spec building its runner inline drives the specimen it names', () => {
        // Given - a spec that starts its own runner over a binary of its facet's fixtures
        const spec =
            "const BIN = resolve(import.meta.dirname, '../_fixtures/specimen-cli/cli.sh');\nexport const { cli } = await specification.cli(BIN);\n";
        const root = specsTree({ 'cli/exec/refusals.spec.ts': spec });

        // Then - the specimen the binary sits in
        expect(specimenOf(join(root, 'cli/exec/refusals.spec.ts'), spec, 'cli')).toBe(
            'specimen-cli',
        );
    });

    test('specimen — an integration spec reaches the module of the fixtures its chains call', () => {
        // Given - a spec importing a module of its facet's fixtures, under integration and under api
        const spec =
            "import { listOrders } from '../_fixtures/orders/orders.js';\nimport { integration } from '../pure.specification.js';\n";
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
