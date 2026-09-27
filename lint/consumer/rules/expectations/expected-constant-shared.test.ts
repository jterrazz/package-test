import { ruleTester } from '@jterrazz/test';

import { expectedConstantShared } from './expected-constant-shared.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

ruleTester().run('expected-constant-shared', expectedConstantShared, {
    invalid: [
        // One test reads it once: the value goes in place, the constant goes.
        {
            code: "const PAGE = 'HTTP/1.1 200 OK';\ntest('a', () => {\n    expect(result.response).toMatch(PAGE);\n});",
            errors: [{ column: 6, line: 1, messageId: 'singleReader' }],
            filename: SPEC,
            output: "test('a', () => {\n    expect(result.response).toMatch('HTTP/1.1 200 OK');\n});",
        },
        // One test reading it twice is still one reader — reported, left to the author.
        {
            code: "const PAGE = 'x';\ntest('a', () => {\n    expect(a).toBe(PAGE);\n    expect(b).toBe(PAGE);\n});",
            errors: [{ column: 6, line: 1, messageId: 'singleReader' }],
            filename: SPEC,
        },
    ],
    valid: [
        // Two tests share it: it earns its name.
        {
            code: "const PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });\ntest('b', () => { expect(b).toBe(PAGE); });",
            filename: SPEC,
        },
        // A helper reads it: how many tests call the helper is no scan's to count.
        {
            code: "const PAGE = 'x';\nfunction check(r) { expect(r).toBe(PAGE); }\ntest('a', () => { check(a); });",
            filename: SPEC,
        },
        // A constant that is no expectation — a Given — is not this rule's.
        {
            code: "const USERS = file('./_seeds/users.sql');\ntest('a', () => { api.seed(USERS); expect(a).toBe(1); });",
            filename: SPEC,
        },
        // An exported constant has readers elsewhere.
        {
            code: "export const PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });",
            filename: SPEC,
        },
    ],
});
