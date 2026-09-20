import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d8wTextBypass } from './d8w-text-bypass.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('d8w-text-bypass', d8wTextBypass as unknown as OxlintRule, {
    invalid: [
        // Raw .text bypass with toContain.
        { code: 'expect(result.text).toContain("hi");', errors: 1 },
        // ...and with toMatch.
        { code: 'expect(result.stdout.text).toMatch("bye");', errors: 1 },
    ],
    valid: [
        // Asserting on the typed subject.
        { code: 'expect(result).toMatch("out.txt");' },
        // A RegExp is the one argument the typed subject cannot take —
        // `toMatch` on an accessor resolves a fixture NAME and throws on a
        // Regex, so chapter 14 prescribes this exact spelling.
        { code: 'expect(result.stdout.text).toMatch(/error: \\d+/u);' },
        { code: 'expect(result.text).toMatch(new RegExp(pattern, "u"));' },
        // Some other property, not .text.
        { code: 'expect(result.value).toContain("hi");' },
        // .text but a non-text matcher.
        { code: 'expect(result.text).toBe("hi");' },
    ],
});
