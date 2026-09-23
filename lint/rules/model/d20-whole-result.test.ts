import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d20WholeResult } from './d20-whole-result.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC = '/repo/specs/api/users/users.spec.ts';

ruleTester.run('d20-whole-result', d20WholeResult as unknown as OxlintRule, {
    invalid: [
        // A body probe alone — the rest of the response regresses unseen.
        {
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response.body.total).toBe(1); });",
            errors: [{ message: /reads result\.response and never compares it whole/u }],
            filename: SPEC,
        },
        // A json probed, a table probed through a RegExp, each reported once.
        {
            code: "test('t', async () => { const result = await cli.exec('x'); expect(result.json.value.a).toBe(1); expect(result.json.value.b).toBe(2); });",
            errors: 1,
            filename: SPEC,
        },
        // A negation, and a RegExp, compare no whole result.
        {
            code: "test('t', async () => { const result = await api.get('/x'); expect(result.response).not.toMatch(`HTTP/1.1 500`); expect(result.json).toMatch(/ok/u); });",
            errors: 2,
            filename: SPEC,
        },
        // Two tables, one compared whole: the other is reported by its name.
        {
            code: "test('t', async () => { const result = await jobs.trigger('x'); await expect(result.table('a')).toBeEmpty(); expect(await result.table('b').query(['id'])).toHaveLength(1); });",
            errors: [{ message: /reads result\.table\('b'\)/u }],
            filename: SPEC,
        },
    ],
    valid: [
        // The whole response, and a precise assertion beside it.
        {
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response).toMatch(`HTTP/1.1 200 OK`); expect(result.response.body.total).toBe(1); });",
            filename: SPEC,
        },
        // A golden is a whole comparison too, and so is a table's emptiness.
        {
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response).toMatch(file('./expected/listed.http')); await expect(result.table('users')).toBeEmpty(); });",
            filename: SPEC,
        },
        // A status alone is D15w's, never this rule's.
        {
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.status).toBe(200); });",
            filename: SPEC,
        },
        // A module test's subject is not an awaited result under specs/.
        {
            code: "test('t', async () => { const result = await api.get('/users'); expect(result.response.body).toBeDefined(); });",
            filename: '/repo/src/model/users.test.ts',
        },
        // A value not awaited from an action is no result.
        {
            code: "test('t', () => { const reply = build(); expect(reply.response.body).toBe(1); });",
            filename: SPEC,
        },
    ],
});
