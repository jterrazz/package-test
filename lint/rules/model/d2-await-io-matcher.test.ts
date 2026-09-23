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
        // A table compared whole — named by its read, or by the rows it is handed.
        { code: "expect(result.table('users')).toMatch([]);", errors: 1 },
        { code: "expect(users).toMatch([[1, 'Ada']]);", errors: 1 },
        { code: "expect(result.table('users')).not.toMatch([[1, 'Ada']]);", errors: 1 },
        { code: 'expect(dir).toBeEmpty();', errors: 1 },
        { code: 'expect(container).toBeRunning();', errors: 1 },
        // A tree golden walks the disk, whatever its subject.
        { code: "expect(result.filesystem).toMatch(directory('./expected/tree/'));", errors: 1 },
        // Negated form is still IO.
        { code: 'expect(dir).not.toBeEmpty();', errors: 1 },
        // A table's emptiness is a query: dropped, it reads as a pass.
        { code: "expect(result.table('orders')).toBeEmpty();", errors: 1 },
    ],
    valid: [
        // Awaited.
        { code: "async function f() { await expect(result.table('users')).toMatch([]); }" },
        // A json compared whole to a list, and a stream to its text, are sync.
        { code: "expect(result.json).toMatch(['a', 'b']);" },
        { code: 'expect(result.value).toMatch([[1, 2]]);' },
        { code: 'expect(result.stdout).toMatch(`built`);' },
        { code: "async function f() { await expect(result.table('orders')).toBeEmpty(); }" },
        // Returned.
        { code: 'const f = () => expect(dir).toBeEmpty();' },
        { code: 'function f() { return expect(container).toBeRunning(); }' },
        // Sync matcher — not this rule's concern.
        { code: 'expect(a).toBe(b);' },
        // Not an expect subject.
        { code: "thing.toMatch([['a']]);" },
        // Promise consumed by an outer expect(...).rejects — handled.
        {
            code: 'async function f() { await expect(expect(c).toBeRunning()).rejects.toThrow(); }',
        },
        // Assigned — the promise is used.
        { code: "const p = expect(result.table('users')).toMatch([]);" },
    ],
});
