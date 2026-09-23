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
    "import { file } from '@jterrazz/test';",
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
    "        const result = await api.seed(file('./seeds/one-order.sql')).get('/orders');",
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

/** A spec running `db migrate`, its `cli` imported from the named specification module. */
function migrating(door: string): string {
    return [
        `import { cli } from '../${door}.specification.js';`,
        "test('a', async () => { await cli.exec('db migrate --dry-run'); });",
        '',
    ].join('\n');
}

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

    test('the split drops an import only a string of the file names', () => {
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
        fixSubjects(root);

        // Then - the create file keeps only what its code reads
        expect(readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8')).not.toContain(
            'import { cli }',
        );
    });

    test('the split drops an import another clause only aliases, and a helper with its doc comment', () => {
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
        fixSubjects(root);

        // Then - the list file names only `other`, the create file neither the helper nor its comment
        const listed = readFileSync(join(root, 'api/orders/list/orders.spec.ts'), 'utf8');
        const created = readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8');
        expect({
            createdHelper: created.includes('Read the list twice') || created.includes('twice'),
            listedApi: listed.includes('import { api }'),
        }).toStrictEqual({ createdHelper: false, listedApi: false });
    });

    test('a move leaves a path naming nothing, and a call spelled in a string, as written', () => {
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
        fixSubjects(root);

        // Then - both read as they did: the missing file is missing from anywhere, the string is text
        const moved = readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8');
        expect({
            missing: moved.includes("file('./requests/nonexistent.http')"),
            quoted: moved.includes('file("./requests/x.http")'),
        }).toStrictEqual({ missing: true, quoted: true });
    });

    test('a test reaching two subjects is reported with its title, and filed with the subject it opens on', () => {
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
        expect(checkOneSubject(root)[0]?.fix).toBe(
            'the test "creates then lists" reaches POST /orders and GET /orders — state what it stands on with a seed, and keep one subject per test',
        );
        fixSubjects(root);
        expect(readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8')).toContain(
            "test('creates then lists'",
        );
    });

    test('a journey goes with the subject it opens on, and the rest of the file is still cut', () => {
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
        fixSubjects(root);

        // Then - two files, the journey with its opening subject, which C29 keeps naming
        const created = readFileSync(join(root, 'api/orders/create/orders.spec.ts'), 'utf8');
        expect({
            journey: created.includes("test('creates then lists'"),
            listed: existsSync(join(root, 'api/orders/list/orders.spec.ts')),
        }).toStrictEqual({ journey: true, listed: true });
        expect(checkOneSubject(root).map(({ file }) => file)).toStrictEqual([
            'api/orders/create/orders.spec.ts',
        ]);
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

    test('a cli command is its first word, unless its runner declares the words of its commands', () => {
        // Given - one spec running `db migrate`, from a runner that declares no list, and one from a runner that does
        const root = specsTree({
            'cli/cli.specification.ts':
                'export const { cleanup, cli } = await specification.cli(BIN);\n',
            'cli/db-cli.specification.ts':
                "export const { cleanup, cli } = await specification.cli(BIN, { commands: ['db', 'migrate'] });\n",
            'cli/first/runs.spec.ts': migrating('cli'),
            'cli/listed/runs.spec.ts': migrating('db-cli'),
        });

        // Then - the first word files the one, the declared words the other
        expect(checkSubjectFolder(root).map(({ fix }) => fix)).toStrictEqual([
            'move it to cli/db/runs.spec.ts — `make fix` moves it, and the ground it stands on',
            'move it to cli/db/migrate/runs.spec.ts — `make fix` moves it, and the ground it stands on',
        ]);
    });

    test('a collection no plural names is listed once the repository declares it', () => {
        // Given - GET /data filed as a singleton would be, in a unit whose config names `data` a collection
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/data/get/listing.spec.ts': [
                "import { api } from '../../api.specification.js';",
                "test('a', async () => { await api.get('/data'); });",
                '',
            ].join('\n'),
        });
        const plain = checkSubjectFolder(root);
        writeFileSync(
            join(dirname(root), 'jterrazz.config.ts'),
            "export default { test: { collections: ['data'] } };\n",
        );
        writeFileSync(join(dirname(root), 'package.json'), '{}\n');

        // Then - no finding before the declaration, and the list folder after it
        expect(plain).toStrictEqual([]);
        expect(checkSubjectFolder(root).map(({ fix }) => fix)).toStrictEqual([
            'move it to api/data/list/listing.spec.ts — `make fix` moves it, and the ground it stands on',
        ]);
    });

    test('a helper the split leaves to several files moves once into the leaf fixtures module', () => {
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
        fixSubjects(root);

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
});
