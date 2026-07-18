import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d2wAwaitSyncMatcher } from './d2w-await-sync-matcher.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('d2w-await-sync-matcher', d2wAwaitSyncMatcher as unknown as OxlintRule, {
    invalid: [
        // Redundant await on a synchronous matcher.
        { code: 'async function f() { await expect(a).toBe(b); }', errors: 1 },
        { code: 'async function f() { await expect(a).toEqual(b); }', errors: 1 },
        { code: 'async function f() { await expect(a).toContain(b); }', errors: 1 },
        { code: 'async function f() { await expect(a).toHaveLength(3); }', errors: 1 },
    ],
    valid: [
        // Not awaited — fine.
        { code: 'expect(a).toBe(b);' },
        // IO matcher awaited — the other rule's domain, not redundant.
        { code: 'async function f() { await expect(rows).toMatchRows([]); }' },
        // .resolves / .rejects make a sync matcher async — await is required.
        { code: 'async function f() { await expect(p).resolves.toEqual(x); }' },
        { code: 'async function f() { await expect(p).rejects.toThrow(); }' },
        // Await on a non-expect subject.
        { code: 'async function f() { await thing.toBe(b); }' },
    ],
});
