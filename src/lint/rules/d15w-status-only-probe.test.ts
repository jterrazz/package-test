import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d15wStatusOnlyProbe } from './d15w-status-only-probe.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC = '/repo/specs/api/events/create-event.test.ts';

ruleTester.run('d15w-status-only-probe', d15wStatusOnlyProbe as unknown as OxlintRule, {
    invalid: [
        // A lone status probe as the test's sole assertion.
        {
            code: `test('rejects', async () => {
                expect(result.status).toBe(422);
            });`,
            errors: 1,
            filename: SPEC,
        },
        // Several status probes, still nothing but status probes.
        {
            code: `it('statuses', async () => {
                expect(result.response.status).toEqual(201);
                expect(first.status).toBe(200);
            });`,
            errors: 1,
            filename: SPEC,
        },
    ],
    valid: [
        // A status probe NEXT TO a golden — the scalpel allowance, silent.
        {
            code: `test('created', async () => {
                expect(result.status).toBe(201);
                expect(result.response).toMatch('created.http');
            });`,
            filename: SPEC,
        },
        // A status probe alongside a row assertion, silent.
        {
            code: `test('persists', async () => {
                expect(result.status).toBe(201);
                await expect(result.table('users')).toMatchRows([{ id: 1 }]);
            });`,
            filename: SPEC,
        },
        // A status probe alongside a toContain, silent.
        {
            code: `test('body', async () => {
                expect(result.status).toBe(200);
                expect(result.stdout).toContain('ok');
            });`,
            filename: SPEC,
        },
        // A string toBe on .status (container status) is not a status probe.
        {
            code: `test('running', async () => {
                expect(neo.status).toBe('running');
            });`,
            filename: SPEC,
        },
        // The golden form — no status probe at all.
        {
            code: `test('golden', async () => {
                expect(result.response).toMatch('created.http');
            });`,
            filename: SPEC,
        },
        // Outside specs/ the rule is inert.
        {
            code: `test('not a spec', async () => {
                expect(result.status).toBe(422);
            });`,
            filename: '/repo/src/core/thing.ts',
        },
        // Not inside a test callback — a bare status probe at module scope.
        {
            code: `expect(result.status).toBe(422);`,
            filename: SPEC,
        },
    ],
});
