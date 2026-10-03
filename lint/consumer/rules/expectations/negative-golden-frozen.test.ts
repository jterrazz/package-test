import { ruleTester } from '@jterrazz/test';

import { negativeGoldenFrozen } from './negative-golden-frozen.js';

const SPEC = '/repo/specs/api/session/session.test.ts';

ruleTester().run('negative-golden-frozen', negativeGoldenFrozen, {
    invalid: [
        {
            name: 'Wrapped in expect(() => …).toThrow() — a negative assertion, unfrozen.',
            code: `test('t', () => { expect(() => expect(result.response).toMatch(file('./_expected/wrong.http'))).toThrow(/x/); });`,
            errors: [{ column: 31, line: 1, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            name: 'Wrapped in expect(…).rejects.toThrow() — the async tree/filesystem form.',
            code: `test('t', async () => { await expect(expect(result.directory('out')).toMatch(directory('./_expected/tree/'))).rejects.toThrow(/x/); });`,
            errors: [{ column: 37, line: 1, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            name: 'A value in place is rewritten in the test as a file is on disk.',
            code: "test('t', () => { expect(() => expect(result.response).toMatch(`HTTP/1.1 500`)).toThrow(/x/); });",
            errors: [{ column: 31, line: 1, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            code: "test('t', async () => { await expect(expect(result.table('users')).toMatch([[1, 'Wrong']])).rejects.toThrow(/x/); });",
            errors: [{ column: 37, line: 1, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            name: 'Frozen:false is not an opt-out.',
            code: `test('t', () => { expect(() => expect(a.stdout).toMatch(file('./_expected/w.txt'), { frozen: false })).toThrow(); });`,
            errors: [{ column: 31, line: 1, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            name: 'The bounded heuristic: the helper owns the try/catch, so the enclosing function is where both halves meet.',
            code: `const message = catchMessage(() => {
                expect(result.stdout).toMatch(file('./_expected/wrong.txt'));
                expect(run).toThrow();
            });`,
            errors: [{ column: 16, line: 2, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            name: 'A helper declared as a function, asserting with toThrowError, is where both halves meet.',
            code: `function failing() {
                expect(result.stdout).toMatch(file('./_expected/wrong.txt'));
                expect(run).toThrowError();
            }`,
            errors: [{ column: 16, line: 2, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            name: 'A helper asserting a rejection is one too.',
            code: `const failing = async () => {
                expect(result.stdout).toMatch(file('./_expected/wrong.txt'));
                await expect(run()).rejects.toBeDefined();
            };`,
            errors: [{ column: 16, line: 2, messageId: 'unfrozenNegativeFixture' }],
            filename: SPEC,
        },
        {
            name: 'Options that name no frozen value, or one that is no literal, freeze nothing.',
            code: `test('t', () => { expect(() => expect(a.stdout).toMatch(file('./_expected/w.txt'), { timeout: 1 })).toThrow(); expect(() => expect(a.stdout).toMatch(file('./_expected/w.txt'), { frozen: FROZEN })).toThrow(); });`,
            errors: [
                { column: 31, line: 1, messageId: 'unfrozenNegativeFixture' },
                { column: 124, line: 1, messageId: 'unfrozenNegativeFixture' },
            ],
            filename: SPEC,
        },
        {
            name: 'A string in place against a result stream, behind a `.not`, or against a text() read, is rewritten in place.',
            code: "test('t', () => { expect(() => expect(result.stderr).toMatch('x')).toThrow(); expect(() => expect(result.json).not.toMatch('x')).toThrow(); expect(() => expect(text(r)).toMatch('x')).toThrow(); });",
            errors: [
                { column: 31, line: 1, messageId: 'unfrozenNegativeFixture' },
                { column: 91, line: 1, messageId: 'unfrozenNegativeFixture' },
                { column: 153, line: 1, messageId: 'unfrozenNegativeFixture' },
            ],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: "A test declared through a suite's member is a test callback too, and a call that is no text() read is no result.",
            code: "suite.test('t', () => { expect(r.stdout).toMatch(file('./_expected/x.txt')); expect(run).toThrow(); });\ntest('t', () => { expect(() => expect(other(r)).toMatch('x')).toThrow(); });",
            filename: SPEC,
        },
        {
            name: "The test's own body asserting a throw is no helper, whether it is `test` or `it`.",
            code: `test('t', () => { expect(r.stdout).toMatch(file('./_expected/x.txt')); expect(run).toThrow(); });\nit('t', () => { expect(r.stdout).toMatch(file('./_expected/x.txt')); expect(run).toThrow(); });`,
            filename: SPEC,
        },
        {
            name: 'A golden at the top of the file sits in no helper, and one inside a block the expect wraps is past a statement.',
            code: "expect(r.stdout).toMatch(file('./_expected/x.txt'));\ntest('t', () => { expect(() => { run(); expect(r.stdout).toMatch(file('./_expected/x.txt')); }).toThrow(); });",
            filename: SPEC,
        },
        {
            name: 'No subject, a subject that is no result, another matcher, no argument, or another assertion than expect, is nothing rewritten in place.',
            code: "test('t', () => { expect(() => expect().toMatch('x')).toThrow(); expect(() => expect(r.other).toMatch('x')).toThrow(); expect(() => expect(stdout).toMatch('x')).toThrow(); expect(() => expect(r.stdout).toContain('x')).toThrow(); expect(() => expect(r.stdout).toMatch()).toThrow(); expect(() => assert(r.stdout).toMatch('x')).toThrow(); });",
            filename: SPEC,
        },
        {
            name: "A part of a text is vitest's, and a string's toMatch is vitest's: update mode writes neither.",
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
        {
            name: 'The frozen opt-out is present — exempt.',
            code: `test('t', () => { expect(() => expect(result.response).toMatch(file('./_expected/wrong.http'), { frozen: true })).toThrow(/x/); });`,
            filename: SPEC,
        },
        {
            code: `test('t', async () => { await expect(expect(d.filesystem).toMatch(directory('./_expected/tree/'), { frozen: true })).rejects.toThrow(); });`,
            filename: SPEC,
        },
        {
            name: 'A positive golden — the toMatch is the assertion, not wrapped.',
            code: `test('t', () => { expect(result.response).toMatch(file('./_expected/ok.http')); });`,
            filename: SPEC,
        },
        {
            name: 'Written under update mode via a helper — not an expect() wrap.',
            code: `test('t', () => { inUpdateMode(() => expect(a.stdout).toMatch(file('./_expected/name.txt'))); });`,
            filename: SPEC,
        },
        {
            name: 'Routed through a helper that owns the try/catch — out of static reach.',
            code: `test('t', async () => { const m = await catchMessage(() => expect(r.response).toMatch(file('./_expected/wrong.http'))); expect(m).toContain('x'); });`,
            filename: SPEC,
        },
        {
            name: 'Outside specs/ the rule is inert.',
            code: `test('t', () => { expect(() => expect(result.response).toMatch(file('./_expected/wrong.http'))).toThrow(); });`,
            filename: '/repo/src/specification/thing.ts',
        },
    ],
});
