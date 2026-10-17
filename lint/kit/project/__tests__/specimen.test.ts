import { forgetTree } from '@jterrazz/typescript/rules';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { specimenOf } from '../specimen.js';

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
        ['an app module', "import { createApp } from '../__fixtures__/specimen-api/app.js';"],
        [
            'the root its server command runs from',
            "specification.website({ root: '../__fixtures__/specimen-api', server: { command: 'node server.mjs' } });",
        ],
        [
            'a binary',
            "const BIN = resolve(import.meta.dirname, '../__fixtures__/specimen-api/cli.sh');",
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
                "const command = 'node specs/website/__fixtures__/specimen-website/server.mjs';",
        });
        const spec = "import { website } from '../deployed.specification.js';\n";

        // Then - the specimen of the runner it was built on
        expect(specimenOf(join(root, 'website/visit/page.spec.ts'), spec, 'website')).toBe(
            'specimen-website',
        );
    });

    test("specimen — the project's own app, and the shared fixtures named only in a comment, are no specimen", () => {
        // Given - a runner starting the project's app, a comment naming a fixture
        const root = specsTree({
            'api/api.specification.ts':
                "// the app, not specs/__fixtures__/app\nimport { app } from '../../src/app.js';",
        });

        // Then - nothing
        expect(
            specimenOf(join(root, 'api/events/list/listing.spec.ts'), SPEC, 'api'),
        ).toBeUndefined();
    });

    test.each([
        [
            'written inline',
            "specification.integration({ root: '../__fixtures__/specimen-api', services: { db: postgres() } });",
        ],
        [
            'hoisted into a const',
            "const ROOT = '../__fixtures__/specimen-api';\nspecification.integration({ root: ROOT, services });",
        ],
        [
            'beside a service that runs a command',
            "specification.integration({ root: '../__fixtures__/specimen-api', services: { worker: process({ command: 'node w.mjs' }) } });",
        ],
        [
            'under an app handed in, not started',
            "const BROKEN = resolve(import.meta.dirname, '../__fixtures__/broken-init');\nspecification.api({ root: BROKEN, server: () => app });",
        ],
    ])("specimen — the root a runner reads its services' ground from is no app, %s", (_, door) => {
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
            "specification.website({ root: './__fixtures__/specimen-website', server: { command: 'node server.mjs' } });",
        ],
        [
            'hoisted into a const',
            "const SITE = resolve(import.meta.dirname, './__fixtures__/specimen-website');\nspecification.website({ root: SITE, server: { command: 'node server.mjs' } });",
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
        // Given - a spec that starts its own runner over a binary of its specification's fixtures
        const spec =
            "const BIN = resolve(import.meta.dirname, '../__fixtures__/specimen-cli/cli.sh');\nexport const { cli } = await specification.cli(BIN);\n";
        const root = specsTree({ 'cli/exec/refusals.spec.ts': spec });

        // Then - the specimen the binary sits in
        expect(specimenOf(join(root, 'cli/exec/refusals.spec.ts'), spec, 'cli')).toBe(
            'specimen-cli',
        );
    });

    test('specimen — an integration spec reaches the module of the fixtures its chains call', () => {
        // Given - a spec importing a module of its specification's fixtures, under integration and under api
        const spec =
            "import { listOrders } from '../__fixtures__/orders/orders.js';\nimport { integration } from '../pure.specification.js';\n";
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

    test.each([
        [
            'outside every call, after a const it is no part of',
            "const other = 1;\nrun('../__fixtures__/specimen-api');\nspecification.website({ server: { command: 'x' } });",
            undefined,
        ],
        [
            'outside every call and every const',
            "run('../__fixtures__/specimen-api');\nspecification.website({ server: { command: 'x' } });",
            undefined,
        ],
        [
            'inside a call a const holds',
            "const app = specification.website({ root: '../__fixtures__/specimen-api', server: { command: 'x' } });",
            'specimen-api',
        ],
        [
            'in a const of a $ name the call reads',
            "const $base = '../__fixtures__/specimen-api';\nspecification.website({ root: $base, server: { command: 'x' } });",
            'specimen-api',
        ],
        [
            'in a const another follows',
            "const R = '../__fixtures__/specimen-api';\nconst after = 1;\nspecification.website({ root: R, server: { command: 'x' } });",
            'specimen-api',
        ],
        [
            'fed to a runner that runs no command, beside one that does',
            "const R = '../__fixtures__/specimen-api';\nspecification.api({ root: R });\nspecification.website({ server: { command: 'x' } });",
            undefined,
        ],
        [
            'in a const after the call',
            "specification.website({ server: { command: 'x' } });\nconst LATE = '../__fixtures__/specimen-api';",
            undefined,
        ],
        [
            'beside a server that runs no command',
            "specification.website({ root: '../__fixtures__/specimen-api', server: { port: 3000 } });",
            undefined,
        ],
        [
            'beside a command outside the server',
            "specification.website({ root: '../__fixtures__/specimen-api', server: { port: 1 }, command: 'x' });",
            undefined,
        ],
        [
            'fed to the second of two runners',
            "const R = '../__fixtures__/specimen-api';\nspecification.api({});\nspecification.website({ root: R, server: { command: 'x' } });",
            'specimen-api',
        ],
    ])('specimen — a root named %s', (_, door, specimen) => {
        // Given - a runner module naming a specimen's folder that way
        const root = specsTree({ 'website/website.specification.ts': door });
        const spec = "import { website } from '../website.specification.js';\n";

        // Then - the app only where a server command runs from it
        expect(specimenOf(join(root, 'website/visit/page.spec.ts'), spec, 'website')).toBe(
            specimen,
        );
    });

    test('specimen — the doors are tried in turn, each once', () => {
        // Given - a spec importing a clean runner and one built on a specimen, two runners importing each other, a runner importing both, and a spec building a clean runner of its own
        const root = specsTree({
            'api/a.specification.ts': "import { b } from './b.specification.js';",
            'api/chain.specification.ts':
                "import { c } from './clean.specification.js';\nimport { s } from './specimen.specification.js';",
            'api/b.specification.ts': "import { a } from './a.specification.js';",
            'api/clean.specification.ts': '',
            'api/specimen.specification.ts':
                "import { createApp } from '../__fixtures__/specimen-api/app.js';",
        });
        const both =
            "import { clean } from '../clean.specification.js';\nimport { api } from '../specimen.specification.js';\n";
        const cycle = "import { a } from '../a.specification.js';\n";
        const chained = "import { api } from '../chain.specification.js';\n";
        const inline =
            "export const { api } = await specification.api({});\nimport { s } from '../specimen.specification.js';\n";

        // Then - the specimen behind each door tried in turn, and nothing from the cycle
        expect([
            specimenOf(join(root, 'api/seed/x.spec.ts'), both, 'api'),
            specimenOf(join(root, 'api/seed/x.spec.ts'), cycle, 'api'),
            specimenOf(join(root, 'api/seed/x.spec.ts'), chained, 'api'),
            specimenOf(join(root, 'api/seed/x.spec.ts'), inline, 'api'),
        ]).toStrictEqual(['specimen-api', undefined, 'specimen-api', 'specimen-api']);
    });

    test('specimen — an integration spec reads its imports in turn, then its own runner, then its doors', () => {
        // Given - integration specs importing a helper before a fixture module, building a runner inline, and only importing a door
        const root = specsTree({
            'integration/integration.specification.ts':
                "import { createApp } from '../__fixtures__/specimen-api/app.js';",
        });
        const imports =
            "import { x } from './helper.js';\nimport { listOrders } from '../__fixtures__/orders/orders.js';\n";
        const inline =
            "const BIN = resolve(import.meta.dirname, '../__fixtures__/specimen-cli/cli.sh');\nexport const { cli } = await specification.cli(BIN);\n";
        const door = "import { integration } from '../integration.specification.js';\n";
        const at = join(root, 'integration/call/x.spec.ts');

        // Then - the fixture module, the runner's specimen, and the door's
        expect([
            specimenOf(at, imports, 'integration'),
            specimenOf(at, inline, 'integration'),
            specimenOf(at, door, 'integration'),
        ]).toStrictEqual(['orders', 'specimen-cli', 'specimen-api']);
    });
});
