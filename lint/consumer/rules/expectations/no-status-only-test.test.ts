import { ruleTester } from '@jterrazz/test';

import { noStatusOnlyTest } from './no-status-only-test.js';

const SPEC = '/repo/specs/api/events/create-event.test.ts';

ruleTester().run('no-status-only-test', noStatusOnlyTest, {
    invalid: [
        {
            name: "A lone status probe as the test's sole assertion.",
            code: `test('rejects', async () => {
                expect(result.status).toBe(422);
            });`,
            errors: [{ column: 0, line: 1, messageId: 'statusOnlyProbe' }],
            filename: SPEC,
        },
        {
            name: 'Several status probes, still nothing but status probes.',
            code: `it('statuses', async () => {
                expect(result.response.status).toEqual(201);
                expect(first.status).toBe(200);
            });`,
            errors: [{ column: 0, line: 1, messageId: 'statusOnlyProbe' }],
            filename: SPEC,
        },
        {
            name: 'The first and the last status, and a probe beside an assertion of another runner, are status probes.',
            code: `test('edges', async () => {
                expect(result.status).toBe(100);
                expect(result.status).toEqual(599);
                assert(result.status).toBe(200);
            });`,
            errors: [{ column: 0, line: 1, messageId: 'statusOnlyProbe' }],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'What is no status — out of range, a fraction, a string, a name, nothing — or no equality, or no `.status`, is no probe.',
            code: [
                "test('t', () => { check(result.status).toBe(200); });",
                "test('t', () => { expect().toBe(200); });",
                "test('t', () => { expect(result.status).toBe(99); });",
                "test('t', () => { expect(result.status).toBe(600); });",
                "test('t', () => { expect(result.status).toBe(200.5); });",
                "test('t', () => { expect(result.status).toBe('200'); });",
                "test('t', () => { expect(result.status).toBe(code); });",
                "test('t', () => { expect(result.status).toBe(); });",
                "test('t', () => { expect(result.status).toBeGreaterThan(200); });",
                "test('t', () => { expect(result.status)['toBe'](200); });",
                "test('t', () => { expect(status).toBe(200); });",
                "test('t', () => { expect(result.code).toBe(200); });",
                "test('t', () => { expect.soft(result.status).toBe(200); expect(x).toBeDefined(); });",
                "test('t', () => { expect(result.status).toBe(200); check(result.status).toEqual(201); expect(y).toBeDefined(); });",
            ].join('\n'),
            filename: SPEC,
        },
        {
            name: 'A test with no assertion, one with no callback, and a call that is no test say nothing.',
            code: "test('t', () => { run(); });\ntest('t');\nrun(() => { expect(result.status).toBe(200); });",
            filename: SPEC,
        },
        {
            name: 'A status probe NEXT TO a golden — the scalpel allowance, silent.',
            code: `test('created', async () => {
                expect(result.status).toBe(201);
                expect(result.response).toMatch(file('./_expected/created.http'));
            });`,
            filename: SPEC,
        },
        {
            name: 'A status probe alongside a row assertion, silent.',
            code: `test('persists', async () => {
                expect(result.status).toBe(201);
                await expect(result.table('users')).toMatch([[1, 'Ada']]);
            });`,
            filename: SPEC,
        },
        {
            name: 'A status probe alongside a toContain, silent.',
            code: `test('body', async () => {
                expect(result.status).toBe(200);
                expect(result.stdout).toContain('ok');
            });`,
            filename: SPEC,
        },
        {
            name: 'A string toBe on .status (container status) is not a status probe.',
            code: `test('running', async () => {
                expect(neo.status).toBe('running');
            });`,
            filename: SPEC,
        },
        {
            name: 'The golden form — no status probe at all.',
            code: `test('golden', async () => {
                expect(result.response).toMatch(file('./_expected/created.http'));
            });`,
            filename: SPEC,
        },
        {
            name: 'Outside specs/ the rule is inert.',
            code: `test('not a spec', async () => {
                expect(result.status).toBe(422);
            });`,
            filename: '/repo/src/specification/thing.ts',
        },
        {
            name: 'Not inside a test callback — a bare status probe at module scope.',
            code: `expect(result.status).toBe(422);`,
            filename: SPEC,
        },
    ],
});
