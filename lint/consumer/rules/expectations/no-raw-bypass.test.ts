import { ruleTester } from '@jterrazz/test';

import { noRawBypass } from './no-raw-bypass.js';

ruleTester().run('no-raw-bypass', noRawBypass, {
    invalid: [
        // Negated, on the other stream: the capture is still what the check reads.
        {
            code: 'expect(result.stderr.raw).not.toContain("warning");',
            errors: [{ column: 0, line: 1, messageId: 'rawBypass' }],
        },
        // The stream as captured, handed to a substring check.
        {
            code: 'expect(result.stdout.raw).toContain("hi");',
            errors: [{ column: 0, line: 1, messageId: 'rawBypass' }],
        },
    ],
    valid: [
        // The comparable text: what a golden compares.
        { code: 'expect(result.stdout.text).toContain("out");' },
        // A RegExp carries no token grammar to lose.
        { code: 'expect(result.stdout.raw).toContain(/\\u001B\\[31m/u);' },
        { code: 'expect(result.raw).toContain(new RegExp(pattern, "u"));' },
        // Some other property.
        { code: 'expect(result.value).toContain("hi");' },
        // .raw but a matcher that is not a substring check.
        { code: 'expect(result.stdout.raw).toBe("hi");' },
    ],
});
