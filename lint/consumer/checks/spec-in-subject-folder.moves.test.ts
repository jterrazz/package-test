import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHARTS, RUNNER, specsTree, TWO_ROUTES } from '../../kit/testing/subject.fixtures.js';
import { checkOneSubjectPerSpec } from './one-subject-per-spec.js';
import { checkSpecInSubjectFolder } from './spec-in-subject-folder.js';
import { fixSpecInSubjectFolder } from './spec-in-subject-folder.moves.js';

describe('fixSpecInSubjectFolder', () => {
    test('subject-moves — the split keeps each test with the imports, constants and helpers it reads, in one describe', () => {
        // Given - the same file, and the golden its GET test reads through a helper
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/_expected/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/orders.spec.ts': TWO_ROUTES,
        });

        // When - the fix runs
        fixSpecInSubjectFolder(root);

        // Then - the create file holds its test, its constant, and nothing the list test read
        expect(existsSync(join(root, 'api/orders/orders.spec.ts'))).toBe(false);
        expect(readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8')).toBe(
            [
                "import { describe, expect, test } from 'vitest';",
                '',
                "import { api } from '../../api.specification.js';",
                '',
                "const ORDER = { item: 'book' };",
                '',
                "describe('orders', () => {",
                "    test('creates an order', async () => {",
                '        // Given - an empty table',
                "        const result = await api.post('/orders', ORDER);",
                '',
                '        // Then - the whole response',
                "        expect(result.response).toMatch('HTTP/1.1 201 Created');",
                '    });',
                '});',
                '',
            ].join('\n'),
        );
        // Then - the list file keeps its helper, and its golden moves beside it, its one reader
        const listed = readFileSync(join(root, 'api/orders/list/orders.spec.ts'), 'utf8');
        expect({
            golden: existsSync(join(root, 'api/orders/list/_expected/listed.http')),
            helper: listed.includes('function listed(result)'),
            path: listed.includes("file('./_expected/listed.http')"),
            unread: listed.includes('ORDER'),
        }).toStrictEqual({ golden: true, helper: true, path: true, unread: false });
    });

    test('subject-moves — the fix moves a templated route to its folder and never a path that reads two ways', () => {
        // Given - the same two files
        const root = specsTree(CHARTS);

        // When - the fix runs
        fixSpecInSubjectFolder(root);

        // Then - the template's file moved, the filled one left where it was
        expect(existsSync(join(root, 'api/indicators/chart/templated.spec.ts'))).toBe(true);
        expect(existsSync(join(root, 'api/charts/filled.spec.ts'))).toBe(true);
    });

    test('subject-moves — a spec of one route outside its folder is moved there, its paths rebased', () => {
        // Given - GET /orders filed under a folder of its own choosing
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/listing.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('a', async () => { await api.get('/orders'); });",
                '',
            ].join('\n'),
        });

        // Then - `spec-in-subject-folder` names the folder, and the fix moves it there
        expect(checkSpecInSubjectFolder(root).map(({ fix }) => fix)).toStrictEqual([
            'move it to api/orders/list/listing.spec.ts — `typescript fix` moves it, and the ground it stands on',
        ]);
        fixSpecInSubjectFolder(root);
        expect(readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8')).toContain(
            "from '../../api.specification.js'",
        );
    });

    test('subject-moves — a move removes the folders it empties, up to the first that still holds something', () => {
        // Given - a spec filed two folders deep, alone in both, and one in a folder below its own subject
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/misc/deep/listing.spec.ts': [
                "import { api } from '../../api.specification.js';",
                "test('a', async () => { await api.get('/orders'); });",
                '',
            ].join('\n'),
            'cli/cli.specification.ts':
                'export const { cleanup, cli } = await specification.cli(BIN);\n',
            'cli/spawn/shop/runs.spec.ts': [
                "import { cli } from '../../cli.specification.js';",
                "test('a', async () => { await cli.exec('spawn shop'); });",
                '',
            ].join('\n'),
        });

        // When - the fixer moves both
        fixSpecInSubjectFolder(root);

        // Then - both folders the first emptied are gone, and the one the second moved into stays
        expect(
            ['api/misc/deep', 'api/misc', 'cli/spawn/shop', 'cli/spawn/runs.spec.ts'].map((path) =>
                existsSync(join(root, path)),
            ),
        ).toStrictEqual([false, false, false, true]);
    });

    test('subject-moves — a move leaves a path naming nothing, and a call spelled in a string, as written', () => {
        // Given - a negative spec's missing file, and a refusal message quoting a call on a file that exists
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/_requests/x.http': 'GET /orders\n',
            'api/orders/listing.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('a', async () => { await api.request(file('./_requests/nonexistent.http')); });",
                "test('b', async () => { await expect(api.get('/orders')).rejects.toThrow('file(\"./_requests/x.http\")'); });",
                '',
            ].join('\n'),
        });

        // When - the fix moves the file one folder down
        fixSpecInSubjectFolder(root);

        // Then - both read as they did: the missing file is missing from anywhere, the string is text
        const moved = readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8');
        expect({
            missing: moved.includes("file('./_requests/nonexistent.http')"),
            quoted: moved.includes('file("./_requests/x.http")'),
        }).toStrictEqual({ missing: true, quoted: true });
    });

    test('subject-moves — a test reaching two subjects is reported with its title, and filed with the subject it opens on', () => {
        // Given - one test that creates, then lists
        const source = [
            "import { api } from '../api.specification.js';",
            "test('creates then lists', async () => { await api.post('/orders', {}); await api.get('/orders'); });",
            '',
        ].join('\n');
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': source,
        });

        // Then - the finding says why no split is offered, and the fix only files the journey
        expect(checkOneSubjectPerSpec(root)[0]?.fix).toBe(
            'the test "creates then lists" reaches POST /orders and GET /orders — state what it stands on with a seed, and keep one subject per test',
        );
        fixSpecInSubjectFolder(root);
        expect(readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8')).toContain(
            "test('creates then lists'",
        );
    });

    test('subject-moves — a journey goes with the subject it opens on, and the rest of the file is still cut', () => {
        // Given - one test on GET, one journey opening on POST and reading GET back
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('lists', async () => { await api.get('/orders'); });",
                "test('creates then lists', async () => { await api.post('/orders', {}); await api.get('/orders'); });",
                '',
            ].join('\n'),
        });

        // When - the fix runs
        fixSpecInSubjectFolder(root);

        // Then - two files, the journey with its opening subject, which `one-subject-per-spec` keeps naming
        const created = readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8');
        expect({
            journey: created.includes("test('creates then lists'"),
            listed: existsSync(join(root, 'api/orders/list/orders.spec.ts')),
        }).toStrictEqual({ journey: true, listed: true });
        expect(checkOneSubjectPerSpec(root).map(({ path }) => path)).toStrictEqual([
            'api/orders/create/orders.spec.ts',
        ]);
    });

    test('subject-moves — a finding its author silenced is neither reported nor fixed', () => {
        // Given - a misfiled spec whose first line says why
        const source = [
            "import { api } from '../api.specification.js'; // checker-disable-line spec-in-subject-folder -- the folder is the case",
            "test('a', async () => { await api.get('/orders'); });",
            '',
        ].join('\n');
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/listing.spec.ts': source,
        });

        // Then - nothing
        expect(checkSpecInSubjectFolder(root)).toStrictEqual([]);
        expect(fixSpecInSubjectFolder(root)).toStrictEqual([]);
    });

    test('subject-moves — a spec of a specimen is no subject: its routes are neither split nor filed', () => {
        // Given - a runner driving a specimen, and a spec under seed/ reaching two of its routes
        const root = specsTree({
            'api/api.specification.ts':
                "import { createApp } from '../_shared/_fixtures/specimen-api/app.js';\n",
            'api/seed/ordering.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('a', async () => { await api.get('/users'); });",
                "test('b', async () => { await api.post('/orders', {}); });",
                '',
            ].join('\n'),
        });

        // Then - neither `one-subject-per-spec` nor `spec-in-subject-folder` reads it, and the fixer leaves it where it is
        expect([
            ...checkOneSubjectPerSpec(root),
            ...checkSpecInSubjectFolder(root),
            ...fixSpecInSubjectFolder(root),
        ]).toStrictEqual([]);
    });

    test('subject-moves — a file of two pages keeps the first in place and writes the second beside it, named for it', () => {
        // Given - one website file visiting the pricing page and an article page
        const root = specsTree({
            'website/pages/home.spec.ts': [
                "import { test } from 'vitest';",
                '',
                "import { website } from '../website.specification.js';",
                '',
                "test('shows the prices', async () => {",
                "    await website.visit('/pricing', async () => {});",
                '});',
                '',
                "test('shows an article', async () => {",
                "    await website.visit('/articles/42', async () => {});",
                '});',
                '',
            ].join('\n'),
            'website/website.specification.ts':
                'export const { cleanup, website } = await specification.website({});\n',
        });

        // When - the fix splits it
        fixSpecInSubjectFolder(root);

        // Then - each page's test in its own file, both in the authored folder, no derived folder made
        const read = (file: string): string => readFileSync(join(root, file), 'utf8');
        expect({
            article: read('website/pages/home-articles-id.spec.ts').includes("'shows an article'"),
            articleLeft: read('website/pages/home.spec.ts').includes("'shows an article'"),
            derived: ['website/pages/pricing', 'website/pages/articles'].map((path) =>
                existsSync(join(root, path)),
            ),
            pricing: read('website/pages/home.spec.ts').includes("'shows the prices'"),
            pricingCopied: read('website/pages/home-articles-id.spec.ts').includes(
                "'shows the prices'",
            ),
        }).toStrictEqual({
            article: true,
            articleLeft: false,
            derived: [false, false],
            pricing: true,
            pricingCopied: false,
        });
    });
});
