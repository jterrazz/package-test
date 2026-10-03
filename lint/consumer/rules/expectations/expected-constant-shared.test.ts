import { ruleTester } from '@jterrazz/test';

import { expectedConstantShared } from './expected-constant-shared.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

ruleTester().run('expected-constant-shared', expectedConstantShared, {
    invalid: [
        {
            name: 'A property named like the constant reads nothing of it.',
            code: "const PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });\ntest('b', () => { expect(b.PAGE).toBe(1); });",
            errors: [{ column: 6, line: 1, messageId: 'singleReader' }],
            filename: SPEC,
            output: "test('a', () => { expect(a).toBe('x'); });\ntest('b', () => { expect(b.PAGE).toBe(1); });",
        },
        {
            name: 'A constant declared beside another is reported, left in place; one declared last in the file is inlined.',
            code: "const PAGE = 'x', OTHER = 1;\ntest('a', () => { expect(a).toBe(PAGE); });",
            errors: [{ column: 6, line: 1, messageId: 'singleReader' }],
            filename: SPEC,
        },
        {
            code: "test('a', () => { expect(a).toBe(PAGE); });\nconst PAGE = 'x';",
            errors: [{ column: 6, line: 2, messageId: 'singleReader' }],
            filename: SPEC,
            output: "test('a', () => { expect(a).toBe('x'); });\n",
        },
        {
            name: 'One test reads it once: the value goes in place, the constant goes.',
            code: "const PAGE = 'HTTP/1.1 200 OK';\ntest('a', () => {\n    expect(result.response).toMatch(PAGE);\n});",
            errors: [{ column: 6, line: 1, messageId: 'singleReader' }],
            filename: SPEC,
            output: "test('a', () => {\n    expect(result.response).toMatch('HTTP/1.1 200 OK');\n});",
        },
        {
            name: 'One test reading it twice is still one reader — reported, left to the author.',
            code: "const PAGE = 'x';\ntest('a', () => {\n    expect(a).toBe(PAGE);\n    expect(b).toBe(PAGE);\n});",
            errors: [{ column: 6, line: 1, messageId: 'singleReader' }],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'A computed read is a read, and a property named like it is none.',
            code: "const PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });\ntest('b', () => { expect(b[PAGE]).toBe({ PAGE: 1 }.PAGE); });",
            filename: SPEC,
        },
        {
            name: 'An expectation read outside any test, a `let`, and a module test are not this rule’s.',
            code: "const PAGE = 'x';\nexpect(a).toBe(PAGE);",
            filename: SPEC,
        },
        {
            code: "let PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });",
            filename: SPEC,
        },
        {
            code: "const PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });",
            filename: '/repo/src/page.test.ts',
        },
        {
            name: 'Two tests share it: it earns its name.',
            code: "const PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });\ntest('b', () => { expect(b).toBe(PAGE); });",
            filename: SPEC,
        },
        {
            name: "A helper reads it: how many tests call the helper is no scan's to count.",
            code: "const PAGE = 'x';\nfunction check(r) { expect(r).toBe(PAGE); }\ntest('a', () => { check(a); });",
            filename: SPEC,
        },
        {
            name: "A constant that is no expectation — a Given — is not this rule's.",
            code: "const USERS = file('./_seeds/users.sql');\ntest('a', () => { api.seed(USERS); expect(a).toBe(1); });",
            filename: SPEC,
        },
        {
            name: 'An exported constant has readers elsewhere.',
            code: "export const PAGE = 'x';\ntest('a', () => { expect(a).toBe(PAGE); });",
            filename: SPEC,
        },
    ],
});
