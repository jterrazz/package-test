import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RUNNER, specsTree } from '../../../__tests__/subject.fixtures.js';
import { splitPlan, subjectSpecs } from '../../../kit/project/spec-subjects.js';
import { splitFiles } from '../spec-in-subject-folder.split.js';
import {
    RICH_ORDERS,
    RICH_SPLIT,
    SHARED_HELPER_ORDERS,
    TYPED_ORDERS,
} from './spec-in-subject-folder.split.fixtures.js';

// invariant: what the split of the one spec under `root` would write, by path; nothing is written.
function filesOf(root: string): (path: string) => string {
    const files = subjectSpecs(root).flatMap((spec) =>
        splitFiles(root, spec, splitPlan(root, spec)),
    );
    return (path) => files.find(({ target }) => target === join(root, path))?.text ?? '';
}

function splitByPath(root: string): Record<string, string> {
    const files = subjectSpecs(root).flatMap((spec) =>
        splitFiles(root, spec, splitPlan(root, spec)),
    );
    return Object.fromEntries(
        files.map(({ target, text }) => [target.slice(root.length + 1), text]),
    );
}

describe('spec-in-subject-folder.split', () => {
    test('splitFiles — the split copies a hook only into the files whose tests read what it sets', () => {
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

    test.each([
        ['moved whole', ''],
        [
            'split in two',
            "    test('creates an order', async () => { await api.post('/orders', {}); });\n",
        ],
    ])(
        'splitFiles — a hook reading an import stays in every file of a spec %s, with its import',
        (_case, more) => {
            // Given - a spec filed under misc/, a hook starting a server it imports, one cleaning up through an imported function
            const root = specsTree({
                'api/api.specification.ts': RUNNER,
                'api/misc/orders.spec.ts': [
                    "import { afterEach, beforeAll, describe, expect, test } from 'vitest';",
                    "import { cleanup } from '@testing-library/react';",
                    "import { server } from '../server.js';",
                    '',
                    "import { api } from '../api.specification.js';",
                    '',
                    'beforeAll(() => server.listen());',
                    'afterEach(cleanup);',
                    '',
                    "describe('orders', () => {",
                    "    test('lists the orders', async () => { expect((await api.get('/orders')).status).toBe(200); });",
                    `${more}});`,
                    '',
                ].join('\n'),
            });

            // When - the files are drafted
            const files = Object.values(splitByPath(root));

            // Then - each holds both hooks and the imports they read
            expect(
                files.map((text) => [
                    text.includes('beforeAll(() => server.listen());'),
                    text.includes('afterEach(cleanup);'),
                    text.includes("import { server } from '../../server.js';"),
                    text.includes("import { cleanup } from '@testing-library/react';"),
                ]),
            ).toStrictEqual(files.map(() => [true, true, true, true]));
        },
    );

    test('splitFiles — the types a moved helper reads move with it, and a type only the tests read stays', () => {
        // Given - three routes: two share a helper typed by an alias and an interface and a type they read themselves, one reads only the interface
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': TYPED_ORDERS,
        });

        // When - the split is drafted
        const read = filesOf(root);

        // Then - the helper's types live in the __setup__ module, exported; the test's own type is copied
        const setup = read('api/orders/__setup__/orders.ts');
        const created = read('api/orders/create/orders.spec.ts');
        const listed = read('api/orders/list/orders.spec.ts');
        const deleted = read('api/orders/delete/orders.spec.ts');
        expect({
            clauses: [
                listed.includes("import { type Answer, answered } from '../__setup__/orders.js';"),
                deleted.includes("import type { Answer } from '../__setup__/orders.js';"),
            ],
            answer: setup.includes('export interface Answer {'),
            imported: created.includes("import { answered } from '../__setup__/orders.js';"),
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

    test('splitFiles — a helper the split leaves to several files moves once into the __setup__ module of the folder they share', () => {
        // Given - two routes sharing a helper and the constant it reads, and a helper that builds a file()
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/__expected__/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/orders.spec.ts': SHARED_HELPER_ORDERS,
        });

        // When - the split is drafted
        const read = filesOf(root);

        // Then - the helper and its constant live once, exported, and the file()-building helper stays copied
        expect(read('api/orders/__setup__/orders.ts')).toBe(
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
            imported: created.includes("import { answered } from '../__setup__/orders.js';"),
            moved: created.includes('function answered'),
        }).toStrictEqual({ copy: true, imported: true, moved: false });
    });

    test("splitFiles — the split leaves an author's __setup__ module as written, and each file keeps its own copy", () => {
        // Given - two routes sharing a helper, beside a __setup__ module the author wrote
        const authored = "export const SEEDED = 'the author wrote this';\n";
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/__setup__/orders.ts': authored,
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
            rewritten: read('api/orders/__setup__/orders.ts') !== '',
        }).toStrictEqual({ copies: [true, true], rewritten: false });
    });

    test('splitFiles — the split files each test with what it reads: neutral tests, hooks, disk-building copies and shared helpers alike, the header in the file it opens on', () => {
        // Given - a spec of three subjects with every kind of shared code
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': RICH_ORDERS,
        });

        // Then - each file the split writes, whole
        expect(splitByPath(root)).toStrictEqual(RICH_SPLIT);
    });

    test('splitFiles — a helper shared from a spec filed elsewhere moves to the folder its holders share, and a file holding none is left as cut', () => {
        // Given - a spec filed under api/misc, whose list and create tests share a constant
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/misc/orders.spec.ts': [
                "import { api } from '../api.specification.js';",
                'const OK = 200;',
                '',
                "test('lists', async () => { expect((await api.get('/orders')).status).toBe(OK); });",
                "test('creates', async () => { expect((await api.post('/orders', {})).status).toBe(OK); });",
                "test('deletes', async () => { await api.delete('/orders/c'); });",
                "test('lists users', async () => { await api.get('/users'); });",
                '',
            ].join('\n'),
        });

        // Then - the constant moves under api/orders, imported where it is read
        const runner = "import { api } from '../../api.specification.js';\n";
        const ok = "import { OK } from '../__setup__/orders.js';\n";
        expect(splitByPath(root)).toStrictEqual({
            'api/orders/__setup__/orders.ts': 'export const OK = 200;\n',
            'api/orders/c/orders.spec.ts': `${runner}\ntest('deletes', async () => { await api.delete('/orders/c'); });\n`,
            'api/orders/create/orders.spec.ts': `${runner}${ok}\ntest('creates', async () => { expect((await api.post('/orders', {})).status).toBe(OK); });\n`,
            'api/orders/list/orders.spec.ts': `${runner}${ok}\ntest('lists', async () => { expect((await api.get('/orders')).status).toBe(OK); });\n`,
            'api/users/list/orders.spec.ts': `${runner}\ntest('lists users', async () => { await api.get('/users'); });\n`,
        });
    });

    test('splitFiles — a helper reading one that reads a disk-building constant is copied with it, whichever is declared first', () => {
        // Given - two routes sharing a helper that reaches a file through another declared after it
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': [
                "import { api } from '../api.specification.js';",
                "const PATH = file('./__requests__/one.http');",
                'function answered() { return requested(); }',
                'function requested() { return PATH; }',
                "test('lists', async () => { await api.get('/orders'); answered(); });",
                "test('creates', async () => { await api.post('/orders', {}); answered(); });",
                '',
            ].join('\n'),
        });

        // Then - no setup module: each file keeps its own copies
        expect(Object.keys(splitByPath(root))).toStrictEqual([
            'api/orders/list/orders.spec.ts',
            'api/orders/create/orders.spec.ts',
        ]);
    });
});
