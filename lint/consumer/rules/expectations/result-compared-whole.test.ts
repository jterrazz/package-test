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
        {
            name: 'A read inside a callback no expect holds, or a whole result with no argument, is no refusal and no comparison.',
            code: "test('t', async () => { const result = await api.get('/x'); wrap(() => result.json.value); expect(result.response).toMatch(); });",
            errors: [
                { column: 71, line: 1, messageId: 'partialOracle' },
                { column: 98, line: 1, messageId: 'partialOracle' },
            ],
            filename: SPEC,
        },
        {
            name: 'A whole result asserted with toBe is no whole comparison.',
            code: "test('t', async () => { const result = await api.get('/x'); expect(result.response).toBe(x); });",
            errors: [{ column: 67, line: 1, messageId: 'partialOracle' }],
            filename: SPEC,
        },
        {
            name: 'A value bound, sent, and a member of it read elsewhere is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const cursor = first.json.next; const second = await api.get('/facts?c=' + cursor); log(cursor.length); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 78, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value bound, sent, and used as a computed key elsewhere is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const cursor = first.json.next; const second = await api.get('/facts?c=' + cursor); log({ [cursor]: 1 }); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 78, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value bound, and sent only by a closure written before it, is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const early = async () => await api.get('/facts?c=' + cursor); const cursor = first.json.next; const second = await early(); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 141, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value handed to a plain function, even awaited, is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.get('/facts'); await send(first.json.next); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 114, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value sent through a chain no name roots is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.get('/facts'); await (pick ? api : other).get('/facts?c=' + first.json.next); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 148, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: "A value inside an expectation's matcher is read.",
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.get('/facts'); await expect(second.response).toMatch(first.json.next); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 141, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: "A value handed to a result's own member is read.",
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.get('/facts'); await second.table(first.json.name); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 122, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A request handed to a function, beside a later await of another, is never sent.',
            code: "test('t', async () => { const first = await api.get('/facts'); log(api.get('/facts?c=' + first.json.next)); const second = await api.get('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 89, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A request held in a name only spelled later is never sent.',
            code: "test('t', async () => { const first = await api.get('/facts'); const next = api.get('/facts?c=' + first.json.next); log(typeof next); const second = await api.get('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 98, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A request held in a name awaited only before it is declared is never sent.',
            code: "test('t', async () => { const first = await api.get('/facts'); const early = async () => await next; const next = api.get('/facts?c=' + first.json.next); const second = await api.get('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 136, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A request held in a name, and another request awaited, sends nothing of it.',
            code: "test('t', async () => { const first = await api.get('/facts'); const next = api.get('/facts?c=' + first.json.next); const second = await api.get('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 98, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value destructured from the result is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const { next } = first.json; const second = await api.get('/facts?c=' + next); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 80, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value bound and never used is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const cursor = first.json.next; const second = await api.get('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 78, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value bound, sent, and read again is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const cursor = first.json.next; const second = await api.get('/facts?c=' + cursor); log(cursor); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 78, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value bound, and reached by a closure written before it, is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const early = () => cursor; const cursor = first.json.next; const second = await api.get('/facts?c=' + cursor); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 106, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value bound, sent, and used as an index elsewhere is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const cursor = first.json.next; const second = await api.get('/facts?c=' + cursor); log(table[cursor]); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 78, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: "A value naming the request's method is read.",
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api[first.json.method]('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 88, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value inside an expectation sent with a request is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.post('/facts', [expect(first.json.next)]); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 111, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
        {
            name: 'A value used in a statement of a callback handed to a request is read.',
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.post('/facts', () => { use(first.json.next); }); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            errors: [
                { column: 115, line: 1, message: /reads first\.json and never compares it whole/u },
            ],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'A value wrapped by a helper inside the request is carried.',
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.post('/facts', encode(first.json.next)); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            filename: SPEC,
        },
        {
            name: 'A value carried through a chain whose first link takes it.',
            code: "test('t', async () => { const first = await api.get('/facts'); const second = await api.params({ cursor: first.json.next }).get('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            filename: SPEC,
        },
        {
            name: 'A name carried as a shorthand property, beside a key and a member spelling the same name.',
            code: "test('t', async () => { const first = await api.get('/facts'); const cursor = first.json.next; const other = { cursor: 1 }; log(other.cursor); const second = await api.params({ cursor }).get('/facts'); expect(second.response).toMatch(`HTTP/1.1 200 OK`); });",
            filename: SPEC,
        },
        {
            name: 'A read whose throw is the subject, through an arrow or a function, compares nothing; a whole string is a whole comparison.',
            code: "test('t', async () => { const result = await api.get('/x'); expect(() => result.json.value).toThrow(); expect(function () { return result.json.value; }).toThrow(); expect(result.response).toMatch('HTTP/1.1 200 OK'); });",
            filename: SPEC,
        },
        {
            name: 'What no awaited result names, a table read by a computed name or another method, and a call that is no test, are out of reach.',
            code: "test('t', async () => { const pending = api.get('/x'); const result = await api.get('/x'); expect(pending.json.a).toBe(1); expect(result.query('a')).toBe(1); expect(result.table(name)).toBe(1); expect(table('a')).toBe(1); expect(pending.table('a')).toBe(1); });\nrun(async () => { const result = await api.get('/x'); expect(result.json.a).toBe(1); });\ntest('t');",
            filename: SPEC,
        },
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
