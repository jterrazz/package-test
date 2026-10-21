import { ruleTester } from '@jterrazz/test';

import { noRawBypass } from '../no-raw-bypass.js';

ruleTester().run('no-raw-bypass', noRawBypass, {
    invalid: [
        {
            name: 'No argument, another constructor, and a RegExp called without `new` are no pattern: the capture is still checked.',
            code: 'expect(result.stdout.raw).toContain();\nexpect(result.stdout.raw).toContain(new Other("x"));\nexpect(result.stdout.raw).toContain(RegExp("x"));',
            errors: [
                { column: 0, line: 1, messageId: 'rawBypass' },
                { column: 0, line: 2, messageId: 'rawBypass' },
                { column: 0, line: 3, messageId: 'rawBypass' },
            ],
        },
        {
            name: 'Negated, on the other stream: the capture is still what the check reads.',
            code: 'expect(result.stderr.raw).not.toContain("warning");',
            errors: [{ column: 0, line: 1, messageId: 'rawBypass' }],
        },
        {
            name: 'The stream as captured, handed to a substring check.',
            code: 'expect(result.stdout.raw).toContain("hi");',
            errors: [{ column: 0, line: 1, messageId: 'rawBypass' }],
        },
    ],
    valid: [
        {
            name: 'Another assertion, and no subject at all, check no capture.',
            code: 'assert(result.stdout.raw).toContain("hi");\nexpect().toContain("hi");',
        },
        {
            name: 'The comparable text: what a golden compares.',
            code: 'expect(result.stdout.text).toContain("out");',
        },
        {
            name: 'A RegExp carries no token grammar to lose.',
            code: String.raw`expect(result.stdout.raw).toContain(/\u001B\[31m/u);`,
        },
        { code: 'expect(result.raw).toContain(new RegExp(pattern, "u"));' },
        { name: 'Some other property.', code: 'expect(result.value).toContain("hi");' },
        {
            name: '.raw but a matcher that is not a substring check.',
            code: 'expect(result.stdout.raw).toBe("hi");',
        },
    ],
});
