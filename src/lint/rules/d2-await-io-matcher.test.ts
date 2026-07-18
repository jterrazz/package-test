import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d2AwaitIoMatcher } from './d2-await-io-matcher.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('d2-await-io-matcher', d2AwaitIoMatcher as unknown as OxlintRule, {
    invalid: [
        // Bare IO matcher — never resolves.
        { code: 'expect(rows).toMatchRows([]);', errors: 1 },
        { code: 'expect(dir).toBeEmpty();', errors: 1 },
        { code: 'expect(container).toBeRunning();', errors: 1 },
        // Negated form is still IO.
        { code: 'expect(dir).not.toBeEmpty();', errors: 1 },
    ],
    valid: [
        // Awaited.
        { code: 'async function f() { await expect(rows).toMatchRows([]); }' },
        // Returned.
        { code: 'const f = () => expect(dir).toBeEmpty();' },
        { code: 'function f() { return expect(container).toBeRunning(); }' },
        // Sync matcher — not this rule's concern.
        { code: 'expect(a).toBe(b);' },
        // Not an expect subject.
        { code: 'thing.toMatchRows([]);' },
        // Promise consumed by an outer expect(...).rejects — handled.
        {
            code: 'async function f() { await expect(expect(c).toBeRunning()).rejects.toThrow(); }',
        },
        // Assigned — the promise is used.
        { code: 'const p = expect(rows).toMatchRows([]);' },
    ],
});
