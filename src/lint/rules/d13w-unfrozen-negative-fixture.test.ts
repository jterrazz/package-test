import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d13wUnfrozenNegativeFixture } from './d13w-unfrozen-negative-fixture.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC = '/repo/specs/api/session/session.test.ts';

ruleTester.run(
    'd13w-unfrozen-negative-fixture',
    d13wUnfrozenNegativeFixture as unknown as OxlintRule,
    {
        invalid: [
            // Wrapped in expect(() => …).toThrow() — a negative assertion, unfrozen.
            {
                code: `test('t', () => { expect(() => expect(result.response).toMatch('wrong.http')).toThrow(/x/); });`,
                errors: 1,
                filename: SPEC,
            },
            // Wrapped in expect(…).rejects.toThrow() — the async tree/filesystem form.
            {
                code: `test('t', async () => { await expect(expect(result.directory('out')).toMatch('tree')).rejects.toThrow(/x/); });`,
                errors: 1,
                filename: SPEC,
            },
            // Frozen:false is not an opt-out.
            {
                code: `test('t', () => { expect(() => expect(a.stdout).toMatch('w.txt', { frozen: false })).toThrow(); });`,
                errors: 1,
                filename: SPEC,
            },
        ],
        valid: [
            // The frozen opt-out is present — exempt.
            {
                code: `test('t', () => { expect(() => expect(result.response).toMatch('wrong.http', { frozen: true })).toThrow(/x/); });`,
                filename: SPEC,
            },
            {
                code: `test('t', async () => { await expect(expect(d.filesystem).toMatch('tree', { frozen: true })).rejects.toThrow(); });`,
                filename: SPEC,
            },
            // A positive golden — the toMatch is the assertion, not wrapped.
            {
                code: `test('t', () => { expect(result.response).toMatch('ok.http'); });`,
                filename: SPEC,
            },
            // Written under update mode via a helper — not an expect() wrap.
            {
                code: `test('t', () => { inUpdateMode(() => expect(a.stdout).toMatch('name.txt')); });`,
                filename: SPEC,
            },
            // Routed through a helper that owns the try/catch — out of static reach.
            {
                code: `test('t', async () => { const m = await catchMessage(() => expect(r.response).toMatch('wrong.http')); expect(m).toContain('x'); });`,
                filename: SPEC,
            },
            // Outside specs/ the rule is inert.
            {
                code: `test('t', () => { expect(() => expect(result.response).toMatch('wrong.http')).toThrow(); });`,
                filename: '/repo/src/core/thing.ts',
            },
        ],
    },
);
