import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d8wRawBypass } from './d8w-raw-bypass.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('d8w-raw-bypass', d8wRawBypass as unknown as OxlintRule, {
    invalid: [
        // The stream as captured, handed to a substring check.
        { code: 'expect(result.stdout.raw).toContain("hi");', errors: 1 },
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
