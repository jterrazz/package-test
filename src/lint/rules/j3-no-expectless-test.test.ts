import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { j3NoExpectlessTest } from './j3-no-expectless-test.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('j3-no-expectless-test', j3NoExpectlessTest as unknown as OxlintRule, {
    invalid: [
        // No expect at all.
        { code: 'test("x", () => { doThing(); });', errors: 1 },
        // Empty body.
        { code: 'test("x", () => {});', errors: 1 },
        // It() form.
        { code: 'it("x", async () => { await run(); });', errors: 1 },
    ],
    valid: [
        // Has an expect.
        { code: 'test("x", () => { expect(a).toBe(b); });' },
        // Awaited IO matcher still counts.
        { code: 'test("x", async () => { await expect(rows).toMatchRows([]); });' },
        // Todo has no callback — skipped.
        { code: 'test.todo("later");' },
        // Not a test call.
        { code: 'helper("x", () => { doThing(); });' },
    ],
});
