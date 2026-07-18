import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d12wResponseBodyProbe } from './d12w-response-body-probe.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC = '/repo/specs/api/events/list-events.test.ts';

ruleTester.run('d12w-response-body-probe', d12wResponseBodyProbe as unknown as OxlintRule, {
    invalid: [
        // Cast-then-probe: one cast + three field reads on the alias = a cluster.
        {
            code: `it('shape', async () => {
                const body = result.response.body as { total: number };
                expect(body.total).toBe(1);
                expect(body.next_cursor).toBeNull();
                expect(body.items).toHaveLength(2);
            });`,
            errors: 1,
            filename: SPEC,
        },
        // Three direct .response.body uses in one test = a cluster.
        {
            code: `test('direct', async () => {
                expect(result.response.body).toMatchObject({ a: 1 });
                expect(result.response.body).toMatchObject({ b: 2 });
                expect(result.response.body).toMatchObject({ c: 3 });
            });`,
            errors: 1,
            filename: SPEC,
        },
    ],
    valid: [
        // Two probes — a legitimate scalpel, silent (below the default threshold).
        {
            code: `it('two probes', async () => {
                const body = result.response.body as { total: number };
                expect(body.total).toBe(1);
                expect(body.next_cursor).toBeNull();
            });`,
            filename: SPEC,
        },
        // The golden form — no body probe at all.
        {
            code: `it('golden', async () => {
                expect(result.response).toMatch('minimal.http');
            });`,
            filename: SPEC,
        },
        // A single direct probe stays silent.
        {
            code: `it('one', async () => {
                expect(result.response.body).toEqual({ ok: true });
            });`,
            filename: SPEC,
        },
        // A cluster raised above the configured threshold is silent.
        {
            code: `it('under raised threshold', async () => {
                const body = result.response.body as { total: number };
                expect(body.total).toBe(1);
                expect(body.next_cursor).toBeNull();
                expect(body.items).toHaveLength(2);
            });`,
            filename: SPEC,
            options: [{ threshold: 5 }],
        },
        // Outside specs/ the rule is inert, even for a cluster.
        {
            code: `it('not a spec', async () => {
                const body = result.response.body as { total: number };
                expect(body.total).toBe(1);
                expect(body.next_cursor).toBeNull();
                expect(body.items).toHaveLength(2);
            });`,
            filename: '/repo/src/core/thing.ts',
        },
    ],
});
