import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { j2NoSleepInSpecs } from './j2-no-sleep-in-specs.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC_FILE = '/repo/specs/cli/exec/exec.test.ts';

ruleTester.run('j2-no-sleep-in-specs', j2NoSleepInSpecs as unknown as OxlintRule, {
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
    ],
    valid: [
        // Framework-level synchronisation.
        {
            code: 'await cli.exec("serve", { waitFor: /listening/ });',
            filename: SPEC_FILE,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'setTimeout(tick, 100);',
            filename: '/repo/src/core/specification/shared/orchestrator.ts',
        },
    ],
});
