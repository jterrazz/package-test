import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d2AwaitIoMatcher } from './io-matcher-awaited.js';

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
        // Negated form is still IO.
        { code: "expect(result.table('users')).not.toMatch([[1, 'Ada']]);", errors: 1 },
        // A tree golden walks the disk, whatever its subject.
        { code: "expect(result.filesystem).toMatch(directory('./expected/tree/'));", errors: 1 },
    ],
    valid: [
        // The two matchers typed `Promise<void>` whatever their argument are the
        // type-aware `no-floating-promises`'s (lint/self/corpus/type-aware.test.ts), not this rule's.
        { code: 'expect(dir).toBeEmpty();' },
        { code: "expect(result.table('orders')).not.toBeEmpty();" },
        { code: 'expect(container).toBeRunning();' },
        // Awaited.
        { code: "async function f() { await expect(result.table('users')).toMatch([]); }" },
        // A json compared whole to a list, and a stream to its text, are sync.
        { code: "expect(result.json).toMatch(['a', 'b']);" },
        { code: 'expect(result.value).toMatch([[1, 2]]);' },
        { code: 'expect(result.stdout).toMatch(`built`);' },
        // Returned.
        { code: "const f = () => expect(result.table('users')).toMatch([]);" },
        { code: "function f() { return expect(tree).toMatch(directory('./expected/tree/')); }" },
        // Sync matcher — not this rule's concern.
        { code: 'expect(a).toBe(b);' },
        // Not an expect subject.
        { code: "thing.toMatch([['a']]);" },
        // Promise consumed by an outer expect(...).rejects — handled.
        {
            code: "async function f() { await expect(expect(users).toMatch([[1, 'Ada']])).rejects.toThrow(); }",
        },
        // Assigned — the promise is used.
        { code: "const p = expect(result.table('users')).toMatch([]);" },
    ],
});
