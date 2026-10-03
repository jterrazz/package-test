import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { splitPlan, subjectSpecs } from '../../kit/project/spec-subjects.js';
import { RUNNER, specsTree } from '../../kit/testing/subject.fixtures.js';
import { splitFiles } from './spec-in-subject-folder.split.js';

/** What the split of the one spec under `root` would write, by path; nothing is written. */
function filesOf(root: string): (path: string) => string {
    const files = subjectSpecs(root).flatMap((spec) =>
        splitFiles(root, spec, splitPlan(root, spec)),
    );
    return (path) => files.find(({ target }) => target === join(root, path))?.text ?? '';
}

const TYPED_ORDERS = [
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
].join('\n');

const SHARED_HELPER_ORDERS = [
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
    "    expect(result.response).toMatch(file('./_expected/listed.http'));",
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
].join('\n');

describe('splitFiles', () => {
    test('the split copies a hook only into the files whose tests read what it sets', () => {
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

        // When - the split is drafted
        const read = filesOf(root);

        // Then - the hook and what it clears stay with the test that sets it, and leave the other file
        const listed = read('api/orders/list/orders.spec.ts');
        const created = read('api/orders/create/orders.spec.ts');
        expect({
            createdHook: created.includes('afterEach'),
            createdSource: created.includes('tickers'),
            listedHook: listed.includes('tickers.clear()'),
        }).toStrictEqual({ createdHook: false, createdSource: false, listedHook: true });
    });

    test('the types a moved helper reads move with it, and a type only the tests read stays', () => {
        // Given - three routes: two share a helper typed by an alias and an interface and a type they read themselves, one reads only the interface
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': TYPED_ORDERS,
        });

        // When - the split is drafted
        const read = filesOf(root);

        // Then - the helper's types live in the _setup module, exported; the test's own type is copied
        const setup = read('api/orders/_setup/orders.ts');
        const created = read('api/orders/create/orders.spec.ts');
        const listed = read('api/orders/list/orders.spec.ts');
        const deleted = read('api/orders/delete/orders.spec.ts');
        expect({
            clauses: [
                listed.includes("import { type Answer, answered } from '../_setup/orders.js';"),
                deleted.includes("import type { Answer } from '../_setup/orders.js';"),
            ],
            answer: setup.includes('export interface Answer {'),
            imported: created.includes("import { answered } from '../_setup/orders.js';"),
            order: [
                setup.includes('Order'),
                created.includes('type Order = { item: string };'),
                listed.includes('type Order = { item: string };'),
            ],
            status: setup.includes('export type Status = number;'),
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

    test('a helper the split leaves to several files moves once into the _setup module of the folder they share', () => {
        // Given - two routes sharing a helper and the constant it reads, and a helper that builds a file()
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/_expected/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/orders.spec.ts': SHARED_HELPER_ORDERS,
        });

        // When - the split is drafted
        const read = filesOf(root);

        // Then - the helper and its constant live once, exported, and the file()-building helper stays copied
        expect(read('api/orders/_setup/orders.ts')).toBe(
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
        const created = read('api/orders/create/orders.spec.ts');
        expect({
            copy: created.includes('function listed(result)'),
            imported: created.includes("import { answered } from '../_setup/orders.js';"),
            moved: created.includes('function answered'),
        }).toStrictEqual({ copy: true, imported: true, moved: false });
    });

    test("the split leaves an author's _setup module as written, and each file keeps its own copy", () => {
        // Given - two routes sharing a helper, beside a _setup module the author wrote
        const authored = "export const SEEDED = 'the author wrote this';\n";
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/_setup/orders.ts': authored,
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

        // When - the split is drafted
        const read = filesOf(root);

        // Then - the module is untouched, and both files still declare the helper they read
        expect({
            copies: ['api/orders/list/orders.spec.ts', 'api/orders/create/orders.spec.ts'].map(
                (file) => read(file).includes('function answered(result)'),
            ),
            rewritten: read('api/orders/_setup/orders.ts') !== '',
        }).toStrictEqual({ copies: [true, true], rewritten: false });
    });
});
