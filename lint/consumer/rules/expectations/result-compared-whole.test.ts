import { ruleTester } from '@jterrazz/test';

import { resultComparedWhole } from './result-compared-whole.js';

const SPEC = '/repo/specs/api/users/users.spec.ts';

ruleTester().run('result-compared-whole', resultComparedWhole, {
    invalid: [
        {
            name: 'A body probe alone — the rest of the response regresses unseen.',
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response.body.total).toBe(1); });",
            errors: [
                {
                    column: 71,
                    line: 1,
                    message: /reads result\.response and never compares it whole/u,
                },
            ],
            filename: SPEC,
        },
        {
            name: 'A json probed, a table probed through a RegExp, each reported once.',
            code: "test('t', async () => { const result = await cli.exec('x'); expect(result.json.value.a).toBe(1); expect(result.json.value.b).toBe(2); });",
            errors: [{ column: 67, line: 1, messageId: 'partialOracle' }],
            filename: SPEC,
        },
        {
            name: 'A negation, and a RegExp, compare no whole result.',
            code: "test('t', async () => { const result = await api.get('/x'); expect(result.response).not.toMatch(`HTTP/1.1 500`); expect(result.json).toMatch(/ok/u); });",
            errors: [
                { column: 67, line: 1, messageId: 'partialOracle' },
                { column: 120, line: 1, messageId: 'partialOracle' },
            ],
            filename: SPEC,
        },
        {
            name: 'Two tables, one compared whole: the other is reported by its name.',
            code: "test('t', async () => { const result = await job.trigger('x'); await expect(result.table('a')).toBeEmpty(); expect(await result.table('b').query(['id'])).toHaveLength(1); });",
            errors: [{ column: 121, line: 1, message: /reads result\.table\('b'\)/u }],
            filename: SPEC,
        },
        {
            name: 'A chain held in a name and never awaited sends nothing: the read is a read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const next = api.get('/facts?cursor=' + first.json.next); expect(next).toBeDefined(); });",
            errors: [
                { column: 103, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A cursor passed through five names is past the carry depth: the read is a read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const a = first.json.next; const b = a; const c = b; const d = c; const e = d; const second = await api.get('/facts?cursor=' + e); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 73, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'A cursor passed through four names on its way to the next request is still carried.',
            code: "test('t', async () => { const first = await api.get('/facts'); const a = first.json.next; const b = a; const c = b; const d = c; const second = await api.get('/facts?cursor=' + d); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            filename: SPEC,
        },
        {
            name: 'A value carried into a request held in a name, and awaited through it.',
            code: "test('t', async () => { const first = await api.get('/facts'); const next = api.get('/facts?cursor=' + first.json.next); const second = await next; expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            filename: SPEC,
        },
        {
            name: 'The whole response, and a precise assertion beside it.',
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response).toMatch(`HTTP/1.1 200 OK`); expect(result.response.body.total).toBe(1); });",
            filename: SPEC,
        },
        {
            name: "A golden is a whole comparison too, and so is a table's emptiness.",
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response).toMatch(file('./_expected/listed.http')); await expect(result.table('users')).toBeEmpty(); });",
            filename: SPEC,
        },
        {
            name: "A status alone is `no-status-only-test`'s, never this rule's.",
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.status).toBe(200); });",
            filename: SPEC,
        },
        {
            name: "A module test's subject is not an awaited result under specs/.",
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response.body).toBeDefined(); });",
            filename: '/repo/src/model/users.test.ts',
        },
        {
            name: 'A value not awaited from an action is no result.',
            code: "test('t', () => { const reply = build(); expect(reply.response.body).toBe(1); });",
            filename: SPEC,
        },
    ],
});
