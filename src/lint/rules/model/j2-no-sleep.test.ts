import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { j2NoSleep } from './j2-no-sleep.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC_FILE = '/repo/specs/cli/exec/exec.test.ts';

ruleTester.run('j2-no-sleep', j2NoSleep as unknown as OxlintRule, {
    invalid: [
        // The classic promisified sleep.
        {
            code: 'await new Promise((resolve) => setTimeout(resolve, 500));',
            errors: [{ messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        // Member form.
        {
            code: 'globalThis.setTimeout(done, 100);',
            errors: [{ messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        // Timer-promise import.
        {
            code: 'import { setTimeout as sleep } from "node:timers/promises";',
            errors: [{ messageId: 'timersImport' }],
            filename: SPEC_FILE,
        },
        // Interval polling is a sleep too.
        {
            code: 'setInterval(poll, 50);',
            errors: [{ messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        // The Atomics.wait primitive blocks the thread.
        {
            code: 'Atomics.wait(view, 0, 0, 500);',
            errors: [{ messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        // A double's implementation ends where its call does: the sleep AFTER
        // One is the test waiting, and still an error.
        {
            code: 'const clone = vi.fn(() => 1); await new Promise((resolve) => setTimeout(resolve, 5));',
            errors: [{ messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
    ],
    valid: [
        // Framework-level synchronisation.
        {
            code: 'await cli.exec("serve", { waitFor: /listening/ });',
            filename: SPEC_FILE,
        },
        // A timer inside a test DOUBLE stages the world — a clone that settles
        // Late, so the results come back out of order — and the test is not the
        // One waiting.
        {
            code: 'const clone = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 5)));',
            filename: SPEC_FILE,
        },
        {
            code: 'git.clone.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5)));',
            filename: SPEC_FILE,
        },
        {
            code: 'const port = mockOf<GitPort>({ clone: () => new Promise((resolve) => setTimeout(resolve, 5)) });',
            filename: SPEC_FILE,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'setTimeout(tick, 100);',
            filename: '/repo/src/specification/facets/_common/orchestrator.ts',
        },
    ],
});
