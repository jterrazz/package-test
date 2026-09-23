import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { forgetTree } from '../src/seams/git/tree.js';
import { checkOneSubject, checkSubjectFolder, fixSubjects } from './checker-subject.js';

/** A specs tree on disk, outside every work tree: the walk reads the disk. */
function specsTree(files: Record<string, string>): string {
    const scratch = mkdtempSync(join(tmpdir(), 'checker-subject-'));
    const root = join(scratch, 'specs');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    forgetTree();
    return root;
}

const RUNNER = 'export const { api, cleanup } = await specification.api({});\n';

/** A spec of two routes, each test on one, a helper and a constant only one of them reads. */
const TWO_ROUTES = [
    "import { file, sql } from '@jterrazz/test';",
    "import { describe, expect, test } from 'vitest';",
    '',
    "import { api } from '../api.specification.js';",
    '',
    "const ORDER = { item: 'book' };",
    '',
    'function listed(result) {',
    "    expect(result.response).toMatch(file('./expected/listed.http'));",
    '}',
    '',
    "describe('reading', () => {",
    "    test('lists the orders', async () => {",
    '        // Given - one order',
    "        const result = await api.seed(sql`INSERT INTO orders VALUES (1);`).get('/orders');",
    '',
    '        // Then - the list',
    '        listed(result);',
    '    });',
    '});',
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
].join('\n');

describe('c29 and c30 — one subject per file, filed under its standard name', () => {
    test('a spec of two routes is reported at the chain reaching the second, naming the split', () => {
        // Given - one file reaching GET /orders and POST /orders
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': TWO_ROUTES,
        });

        // Then - one C29 finding, where the second route is sent, and no C30 before the split
        const [finding] = checkOneSubject(root);
        expect({ column: finding?.column, line: finding?.line }).toStrictEqual({
            column: 30,
            line: 25,
        });
        expect(finding?.found).toBe('a spec reaching 2 subjects — GET /orders, POST /orders');
        expect(finding?.fix).toBe(
            'split it, one file per subject — api/orders/list/orders.spec.ts, api/orders/create/orders.spec.ts — `make fix` splits it',
        );
        expect(checkSubjectFolder(root)).toStrictEqual([]);
    });

    test('the split keeps each test with the imports, constants and helpers it reads, in one describe', () => {
        // Given - the same file, and the golden its GET test reads through a helper
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/expected/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/orders.spec.ts': TWO_ROUTES,
        });

        // When - the fix runs
        fixSubjects(root);

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
            golden: existsSync(join(root, 'expected/listed.http')),
            helper: listed.includes('function listed(result)'),
            path: listed.includes("file('../../../expected/listed.http')"),
            unread: listed.includes('ORDER'),
        }).toStrictEqual({ golden: true, helper: true, path: true, unread: false });
    });

    test('a spec of one route outside its folder is moved there, its paths rebased', () => {
        // Given - GET /orders filed under a folder of its own choosing
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/listing.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('a', async () => { await api.get('/orders'); });",
                '',
            ].join('\n'),
        });

        // Then - C30 names the folder, and the fix moves it there
        expect(checkSubjectFolder(root).map(({ fix }) => fix)).toStrictEqual([
            'move it to api/orders/list/listing.spec.ts — `make fix` moves it, and the ground it stands on',
        ]);
        fixSubjects(root);
        expect(readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8')).toContain(
            "from '../../api.specification.js'",
        );
    });

    test('a test reaching two subjects is reported with its title, and nothing is cut', () => {
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

        // Then - the finding says why no split is offered, and the fix leaves the file
        expect(checkOneSubject(root)[0]?.fix).toBe(
            'split it by subject; the test "creates then lists" reaches POST /orders and GET /orders — state what it stands on with a seed, and keep one subject per test',
        );
        fixSubjects(root);
        expect(readFileSync(join(root, 'api/orders/orders.spec.ts'), 'utf8')).toBe(source);
    });

    test('a finding its author silenced is neither reported nor fixed', () => {
        // Given - a misfiled spec whose first line says why
        const source = [
            "import { api } from '../api.specification.js'; // checker-disable-line c30 -- the folder is the case",
            "test('a', async () => { await api.get('/orders'); });",
            '',
        ].join('\n');
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/listing.spec.ts': source,
        });

        // Then - nothing
        expect(checkSubjectFolder(root)).toStrictEqual([]);
        expect(fixSubjects(root)).toStrictEqual([]);
    });
});
