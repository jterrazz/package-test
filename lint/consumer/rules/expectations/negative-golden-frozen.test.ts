import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { negativeGoldenFrozen } from './negative-golden-frozen.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC = '/repo/specs/api/session/session.test.ts';

ruleTester.run('negative-golden-frozen', negativeGoldenFrozen as unknown as OxlintRule, {
    invalid: [
        // Wrapped in expect(() => …).toThrow() — a negative assertion, unfrozen.
        {
            code: `test('t', () => { expect(() => expect(result.response).toMatch(file('./expected/wrong.http'))).toThrow(/x/); });`,
            errors: 1,
            filename: SPEC,
        },
        // Wrapped in expect(…).rejects.toThrow() — the async tree/filesystem form.
        {
            code: `test('t', async () => { await expect(expect(result.directory('out')).toMatch(directory('./expected/tree/'))).rejects.toThrow(/x/); });`,
            errors: 1,
            filename: SPEC,
        },
        // A value in place is rewritten in the test as a file is on disk.
        {
            code: "test('t', () => { expect(() => expect(result.response).toMatch(`HTTP/1.1 500`)).toThrow(/x/); });",
            errors: 1,
            filename: SPEC,
        },
        {
            code: "test('t', async () => { await expect(expect(result.table('users')).toMatch([[1, 'Wrong']])).rejects.toThrow(/x/); });",
            errors: 1,
            filename: SPEC,
        },
        // Frozen:false is not an opt-out.
        {
            code: `test('t', () => { expect(() => expect(a.stdout).toMatch(file('./expected/w.txt'), { frozen: false })).toThrow(); });`,
            errors: 1,
            filename: SPEC,
        },
        // The bounded heuristic: the helper owns the try/catch, so the
        // enclosing function is where both halves meet.
        {
            code: `const message = catchMessage(() => {
                expect(result.stdout).toMatch(file('./expected/wrong.txt'));
                expect(run).toThrow();
            });`,
            errors: 1,
            filename: SPEC,
        },
    ],
    valid: [
        // A part of a text is vitest's, and a string's toMatch is vitest's: update mode writes neither.
        {
            code: "test('t', () => { expect(() => expect(result.stdout).toMatch(/x/)).toThrow(); });",
            filename: SPEC,
        },
        {
            code: "test('t', () => { expect(() => expect(result.stdout.text).toMatch('x')).toThrow(); });",
            filename: SPEC,
        },
        {
            code: "test('t', () => { expect(() => expect(result.response).toMatch(`HTTP/1.1 500`, { frozen: true })).toThrow(); });",
            filename: SPEC,
        },
        // The frozen opt-out is present — exempt.
        {
            code: `test('t', () => { expect(() => expect(result.response).toMatch(file('./expected/wrong.http'), { frozen: true })).toThrow(/x/); });`,
            filename: SPEC,
        },
        {
            code: `test('t', async () => { await expect(expect(d.filesystem).toMatch(directory('./expected/tree/'), { frozen: true })).rejects.toThrow(); });`,
            filename: SPEC,
        },
        // A positive golden — the toMatch is the assertion, not wrapped.
        {
            code: `test('t', () => { expect(result.response).toMatch(file('./expected/ok.http')); });`,
            filename: SPEC,
        },
        // Written under update mode via a helper — not an expect() wrap.
        {
            code: `test('t', () => { inUpdateMode(() => expect(a.stdout).toMatch(file('./expected/name.txt'))); });`,
            filename: SPEC,
        },
        // Routed through a helper that owns the try/catch — out of static reach.
        {
            code: `test('t', async () => { const m = await catchMessage(() => expect(r.response).toMatch(file('./expected/wrong.http'))); expect(m).toContain('x'); });`,
            filename: SPEC,
        },
        // Outside specs/ the rule is inert.
        {
            code: `test('t', () => { expect(() => expect(result.response).toMatch(file('./expected/wrong.http'))).toThrow(); });`,
            filename: '/repo/src/specification/thing.ts',
        },
    ],
});
