import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHARTS, RUNNER, specsTree, TWO_ROUTES } from '../../engine/testing/subject.fixtures.js';
import { checkOneSubjectPerSpec } from './one-subject-per-spec.js';
import { checkSpecInSubjectFolder } from './spec-in-subject-folder.js';
import { fixSpecInSubjectFolder } from './spec-in-subject-folder.moves.js';

describe('fixSpecInSubjectFolder', () => {
    test('subject-moves — the split keeps each test with the imports, constants and helpers it reads, in one describe', () => {
        // Given - the same file, and the golden its GET test reads through a helper
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/expected/listed.http': 'HTTP/1.1 200 OK\n',
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
        // Then - the list file keeps its helper, and names the golden from where it now stands
        const listed = readFileSync(join(root, 'api/orders/list/orders.spec.ts'), 'utf8');
        expect({
            golden: existsSync(join(root, 'shared/expected/listed.http')),
            helper: listed.includes('function listed(result)'),
            path: listed.includes("file('../../../shared/expected/listed.http')"),
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

    test('subject-moves — the split copies a hook only into the files whose tests read what it sets', () => {
        // Given - two routes, a ticker source only the list test sets, and the hook that clears it
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': [
                "import { afterEach, describe, expect, test } from 'vitest';",
                '',
                "import { api } from '../api.specification.js';",
                '',
                'const tickers = new Map();',
                '',
                "describe('orders', () => {",
                '    afterEach(() => {',
                '        tickers.clear();',
                '    });',
                '',
                "    test('lists the orders', async () => {",
                '        // Given - one ticker',
                "        tickers.set('BTC', 1);",
                "        const result = await api.get('/orders');",
                '',
                '        // Then - the list',
                '        expect(result.status).toBe(200);',
                '    });',
                '',
                "    test('creates an order', async () => {",
                '        // Given - an empty table',
                "        const result = await api.post('/orders', {});",
                '',
                '        // Then - created',
                '        expect(result.status).toBe(201);',
                '    });',
                '});',
                '',
            ].join('\n'),
        });

        // When - the fix splits it
        fixSpecInSubjectFolder(root);

        // Then - the hook and what it clears stay with the test that sets it, and leave the other file
        const listed = readFileSync(join(root, 'api/orders/list/orders.spec.ts'), 'utf8');
        const created = readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8');
        expect({
            createdHook: created.includes('afterEach'),
            createdSource: created.includes('tickers'),
            listedHook: listed.includes('tickers.clear()'),
        }).toStrictEqual({ createdHook: false, createdSource: false, listedHook: true });
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
            'move it to api/orders/list/listing.spec.ts — `make fix` moves it, and the ground it stands on',
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

    test('subject-moves — the split drops an import only a string of the file names', () => {
        // Given - a file whose second route's test only names `cli` inside a string
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': [
                "import { cli } from '../../cli/cli.specification.js';",
                "import { api } from '../api.specification.js';",
                "test('lists', async () => { await api.get('/orders'); await cli.exec('x'); });",
                "test('creates', async () => { await api.post('/orders', { from: 'cli-app' }); });",
                '',
            ].join('\n'),
        });

        // When - the fix splits it
        fixSpecInSubjectFolder(root);

        // Then - the create file keeps only what its code reads
        expect(readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8')).not.toContain(
            'import { cli }',
        );
    });

    test('subject-moves — the split drops an import another clause only aliases, and a helper with its doc comment', () => {
        // Given - one handle imported twice under two names, and a documented helper one test calls
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': [
                "import { api } from '../api.specification.js';",
                "import { api as other } from '../other.specification.js';",
                '',
                '/** Read the list twice. */',
                'function twice(): void {}',
                '',
                "test('lists', async () => { twice(); await other.get('/orders'); });",
                "test('creates', async () => { await api.post('/orders', {}); });",
                '',
            ].join('\n'),
        });

        // When - the fix splits it
        fixSpecInSubjectFolder(root);

        // Then - the list file names only `other`, the create file neither the helper nor its comment
        const listed = readFileSync(join(root, 'api/orders/list/orders.spec.ts'), 'utf8');
        const created = readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8');
        expect({
            createdHelper: created.includes('Read the list twice') || created.includes('twice'),
            listedApi: listed.includes('import { api }'),
        }).toStrictEqual({ createdHelper: false, listedApi: false });
    });

    test('subject-moves — a move leaves a path naming nothing, and a call spelled in a string, as written', () => {
        // Given - a negative spec's missing file, and a refusal message quoting a call on a file that exists
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/requests/x.http': 'GET /orders\n',
            'api/orders/listing.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('a', async () => { await api.request(file('./requests/nonexistent.http')); });",
                "test('b', async () => { await expect(api.get('/orders')).rejects.toThrow('file(\"./requests/x.http\")'); });",
                '',
            ].join('\n'),
        });

        // When - the fix moves the file one folder down
        fixSpecInSubjectFolder(root);

        // Then - both read as they did: the missing file is missing from anywhere, the string is text
        const moved = readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8');
        expect({
            missing: moved.includes("file('./requests/nonexistent.http')"),
            quoted: moved.includes('file("./requests/x.http")'),
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
        expect(checkOneSubjectPerSpec(root).map(({ file }) => file)).toStrictEqual([
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
                "import { createApp } from '../shared/fixtures/specimen-api/app.js';\n",
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

    test('subject-moves — the types a moved helper reads move with it, and a type only the tests read stays', () => {
        // Given - three routes: two share a helper typed by an alias and an interface and a type they read themselves, one reads only the interface
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': [
                "import { expect, test } from 'vitest';",
                '',
                "import { api } from '../api.specification.js';",
                '',
                'type Status = number;',
                '',
                '/** What an answer carries. */',
                'interface Answer {',
                '    status: Status;',
                '}',
                '',
                'type Order = { item: string };',
                '',
                'function answered(result: Answer) {',
                '    expect(result.status).toBe(200);',
                '}',
                '',
                "test('lists', async () => {",
                "    const answer: Answer = await api.get('/orders');",
                '    const none: Order[] = [];',
                '    answered(answer);',
                '    expect(none).toStrictEqual([]);',
                '});',
                '',
                "test('creates', async () => {",
                "    const order: Order = { item: 'book' };",
                "    answered(await api.post('/orders', order));",
                '});',
                '',
                "test('deletes', async () => {",
                "    const answer: Answer = await api.delete('/orders/1');",
                '    expect(answer.status).toBe(204);',
                '});',
                '',
            ].join('\n'),
        });

        // When - the fix splits it
        fixSpecInSubjectFolder(root);

        // Then - the helper's types live in the fixtures module, exported; the test's own type is copied
        const fixtures = readFileSync(join(root, 'api/orders/orders.fixtures.ts'), 'utf8');
        const created = readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8');
        const listed = readFileSync(join(root, 'api/orders/list/orders.spec.ts'), 'utf8');
        const deleted = readFileSync(join(root, 'api/orders/delete/orders.spec.ts'), 'utf8');
        expect({
            clauses: [
                listed.includes("import { type Answer, answered } from '../orders.fixtures.js';"),
                deleted.includes("import type { Answer } from '../orders.fixtures.js';"),
            ],
            answer: fixtures.includes('export interface Answer {'),
            imported: created.includes("import { answered } from '../orders.fixtures.js';"),
            order: [
                fixtures.includes('Order'),
                created.includes('type Order = { item: string };'),
                listed.includes('type Order = { item: string };'),
            ],
            status: fixtures.includes('export type Status = number;'),
            typesLeft: created.includes('Answer') || created.includes('Status'),
        }).toStrictEqual({
            answer: true,
            clauses: [true, true],
            imported: true,
            order: [false, true, true],
            status: true,
            typesLeft: false,
        });
    });

    test('subject-moves — a helper the split leaves to several files moves once into the leaf fixtures module', () => {
        // Given - two routes sharing a helper and the constant it reads, and a helper that builds a file()
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/expected/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/orders.spec.ts': [
                "import { file } from '@jterrazz/test';",
                "import { expect, test } from 'vitest';",
                '',
                "import { api } from '../api.specification.js';",
                '',
                'const OK = 200;',
                '',
                '/** The status every answer carries. */',
                'function answered(result) {',
                '    expect(result.status).toBe(OK);',
                '}',
                '',
                'function listed(result) {',
                "    expect(result.response).toMatch(file('./expected/listed.http'));",
                '}',
                '',
                "test('lists', async () => {",
                "    const result = await api.get('/orders');",
                '    answered(result);',
                '    listed(result);',
                '});',
                '',
                "test('creates', async () => {",
                "    const result = await api.post('/orders', {});",
                '    answered(result);',
                '    listed(result);',
                '});',
                '',
            ].join('\n'),
        });

        // When - the fix splits it
        fixSpecInSubjectFolder(root);

        // Then - the helper and its constant live once, exported, and the file()-building helper stays copied
        expect(readFileSync(join(root, 'api/orders/orders.fixtures.ts'), 'utf8')).toBe(
            [
                "import { expect } from 'vitest';",
                '',
                'export const OK = 200;',
                '',
                '/** The status every answer carries. */',
                'export function answered(result) {',
                '    expect(result.status).toBe(OK);',
                '}',
                '',
            ].join('\n'),
        );
        const created = readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8');
        expect({
            copy: created.includes('function listed(result)'),
            imported: created.includes("import { answered } from '../orders.fixtures.js';"),
            moved: created.includes('function answered'),
        }).toStrictEqual({ copy: true, imported: true, moved: false });
    });

    test("subject-moves — the split leaves an author's fixtures module as written, and each file keeps its own copy", () => {
        // Given - two routes sharing a helper, beside a fixtures module the author wrote
        const authored = "export const SEEDED = 'the author wrote this';\n";
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.fixtures.ts': authored,
            'api/orders/orders.spec.ts': [
                "import { expect, test } from 'vitest';",
                '',
                "import { api } from '../api.specification.js';",
                '',
                'function answered(result) {',
                '    expect(result.status).toBe(200);',
                '}',
                '',
                "test('lists', async () => {",
                "    answered(await api.get('/orders'));",
                '});',
                '',
                "test('creates', async () => {",
                "    answered(await api.post('/orders', {}));",
                '});',
                '',
            ].join('\n'),
        });

        // When - the fix splits it
        fixSpecInSubjectFolder(root);

        // Then - the module is untouched, and both files still declare the helper they read
        expect({
            copies: ['api/orders/list/orders.spec.ts', 'api/orders/create/orders.spec.ts'].map(
                (file) =>
                    readFileSync(join(root, file), 'utf8').includes('function answered(result)'),
            ),
            module: readFileSync(join(root, 'api/orders/orders.fixtures.ts'), 'utf8'),
        }).toStrictEqual({ copies: [true, true], module: authored });
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
