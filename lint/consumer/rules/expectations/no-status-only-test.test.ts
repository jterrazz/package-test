import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noStatusOnlyTest } from './no-status-only-test.js';

const SPEC = '/repo/specs/api/events/create-event.test.ts';

ruleTester().run('no-status-only-test', noStatusOnlyTest, {
    invalid: [
        // A lone status probe as the test's sole assertion.
        {
            code: `test('rejects', async () => {
                expect(result.status).toBe(422);
            });`,
            errors: [{ column: 0, line: 1, messageId: 'statusOnlyProbe' }],
            filename: SPEC,
        },
        // Several status probes, still nothing but status probes.
        {
            code: `it('statuses', async () => {
                expect(result.response.status).toEqual(201);
                expect(first.status).toBe(200);
            });`,
            errors: [{ column: 0, line: 1, messageId: 'statusOnlyProbe' }],
            filename: SPEC,
        },
    ],
    valid: [
        // A status probe NEXT TO a golden — the scalpel allowance, silent.
        {
            code: `test('created', async () => {
                expect(result.status).toBe(201);
                expect(result.response).toMatch(file('./_expected/created.http'));
            });`,
            filename: SPEC,
        },
        // A status probe alongside a row assertion, silent.
        {
            code: `test('persists', async () => {
                expect(result.status).toBe(201);
                await expect(result.table('users')).toMatch([[1, 'Ada']]);
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
                expect(result.response).toMatch(file('./_expected/created.http'));
            });`,
            filename: SPEC,
        },
        // Outside specs/ the rule is inert.
        {
            code: `test('not a spec', async () => {
                expect(result.status).toBe(422);
            });`,
            filename: '/repo/src/specification/thing.ts',
        },
        // Not inside a test callback — a bare status probe at module scope.
        {
            code: `expect(result.status).toBe(422);`,
            filename: SPEC,
        },
    ],
});
