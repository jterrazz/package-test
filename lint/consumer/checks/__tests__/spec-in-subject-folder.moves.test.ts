import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHARTS, RUNNER, specsTree, TWO_ROUTES } from '../../../__tests__/subject.fixtures.js';
import { checkOneSubjectPerSpec } from '../one-subject-per-spec.js';
import { checkSpecInSubjectFolder } from '../spec-in-subject-folder.js';
import { fixSpecInSubjectFolder } from '../spec-in-subject-folder.moves.js';
import { readingGround, TWO_PAGES } from './spec-in-subject-folder.moves.fixtures.js';

const listing = (rule: string): string =>
    `import { api } from '../api.specification.js'; // checker-disable-line ${rule} -- filed by its author\ntest('a', async () => { await api.get('/orders'); });\n`;

describe('fixSpecInSubjectFolder', () => {
    test('subject-moves — the split keeps each test with the imports, constants and helpers it reads, under the group it stood in', () => {
        // Given - the same file, and the golden its GET test reads through a helper
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/__expected__/listed.http': 'HTTP/1.1 200 OK\n',
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
                "describe('writing', () => {",
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
            golden: existsSync(join(root, 'api/orders/list/__expected__/listed.http')),
            helper: listed.includes('function listed(result)'),
            path: listed.includes("file('./__expected__/listed.http')"),
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

    test('subject-moves — a spec whose ground an earlier move lifted is moved from the text the lift repointed', () => {
        // Given - two specs filed under misc/, of two collections, reading one expected file beside them
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/misc/__expected__/x.json': '[]\n',
            'api/misc/a.spec.ts': readingGround('orders'),
            'api/misc/b.spec.ts': readingGround('users'),
        });

        // When - the fix moves both
        fixSpecInSubjectFolder(root);

        // Then - the ground is lifted to the folder they share, and each moved spec reads it there
        expect(
            ['api/orders/list/a.spec.ts', 'api/users/list/b.spec.ts'].map(
                (path) =>
                    /file\('(?<to>[^']+)'\)/u.exec(readFileSync(join(root, path), 'utf8'))?.groups
                        ?.to,
            ),
        ).toStrictEqual(['../../__expected__/x.json', '../../__expected__/x.json']);
        expect(existsSync(join(root, 'api/__expected__/x.json'))).toBe(true);
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

    test('subject-moves — a spec of a specimen is no subject: its routes are neither split nor filed', () => {
        // Given - a runner driving a specimen, and a spec under seed/ reaching two of its routes
        const root = specsTree({
            'api/api.specification.ts':
                "import { createApp } from '../__fixtures__/specimen-api/app.js';\n",
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

    test('subject-moves — a file of two pages is left whole: no folder names the second page, and the split names no file its author did not', () => {
        // Given - one website file visiting the pricing page and an article page
        const root = specsTree({
            'website/pages/home.spec.ts': TWO_PAGES,
            'website/website.specification.ts':
                'export const { cleanup, website } = await specification.website({});\n',
        });

        // When - the fix runs
        const done = fixSpecInSubjectFolder(root);

        // Then - nothing written, the file as it was, and the check says why the fixer left it
        expect({
            done,
            fix: checkOneSubjectPerSpec(root).map((spotted) => spotted.fix),
            kept: readFileSync(join(root, 'website/pages/home.spec.ts'), 'utf8') === TWO_PAGES,
        }).toStrictEqual({
            done: [],
            fix: [
                "split it by hand, one file per subject — `typescript fix` refuses: visit /articles/:id has no standard folder: the file it goes to is its author's to name",
            ],
            kept: true,
        });
    });

    test('subject-moves — a spec in its folder, silenced on its own rule, or one of whose targets is taken, is left; one silenced on the other rule is moved', () => {
        // Given - a spec in its folder, a listing and a two-subject spec silenced on their rules, one silenced on the other rule, and specs whose targets are taken
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/list/listing.spec.ts':
                "import { api } from '../../api.specification.js';\ntest('a', async () => { await api.get('/orders'); });\n",
            'api/orders/orders.spec.ts': TWO_ROUTES.replace(
                '        // Given - an empty table',
                '        // checker-disable-next-line one-subject-per-spec -- one journey',
            ),
            'api/orders/silenced.spec.ts': listing('spec-in-subject-folder'),
            'api/orders/wrong.spec.ts': listing('one-subject-per-spec'),
        });
        const taken = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/create/orders.spec.ts': 'kept\n',
            'api/orders/list/listing.spec.ts': 'kept\n',
            'api/orders/listing.spec.ts': listing('no-rule'),
            'api/orders/orders.spec.ts': TWO_ROUTES,
        });

        // When - the fix runs
        const done = fixSpecInSubjectFolder(root);

        // Then - only the spec silenced on the other rule moved, and the one in its folder is untouched
        expect([
            done,
            readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8'),
            fixSpecInSubjectFolder(taken),
        ]).toStrictEqual([
            ['api/orders/wrong.spec.ts → api/orders/list/wrong.spec.ts'],
            "import { api } from '../../api.specification.js';\ntest('a', async () => { await api.get('/orders'); });\n",
            [],
        ]);
    });

    test('subject-moves — a split keeping the file in the folder of its second subject rewrites it there, and git sees the new file beside it, no rename', () => {
        // Given - a two-subject spec already in its second subject's folder, committed
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/create/orders.spec.ts': TWO_ROUTES.replace("'../api", "'../../api"),
        });
        const checkout = dirname(root);
        const git = (...args: string[]): string =>
            execFileSync('git', args, { cwd: checkout, encoding: 'utf8' });
        git('init', '--quiet');
        git('add', '.');
        git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'specs');

        // When - the fix runs
        const done = fixSpecInSubjectFolder(root);

        // Then - only the written file is reported, and the kept file is modified in place
        expect([
            done,
            git('status', '--porcelain').split('\n').filter(Boolean).toSorted(),
        ]).toStrictEqual([
            ['api/orders/create/orders.spec.ts → api/orders/list/orders.spec.ts'],
            [' M specs/api/orders/create/orders.spec.ts', '?? specs/api/orders/list/'],
        ]);
    });
});
