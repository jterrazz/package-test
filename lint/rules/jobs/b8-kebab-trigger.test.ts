import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { b8KebabTrigger } from './b8-kebab-trigger.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('b8-kebab-trigger', b8KebabTrigger as unknown as OxlintRule, {
    invalid: [
        { code: 'await jobs.trigger("NightlyReport");', errors: 1 },
        { code: 'await jobs.trigger("nightly_report");', errors: 1 },
        { code: 'await jobs.trigger("nightly report");', errors: 1 },
        { code: 'await jobs.trigger("nightly--report");', errors: 1 },
    ],
    valid: [
        { code: 'await jobs.trigger("nightly-report");' },
        { code: 'await jobs.trigger("send-welcome-emails");' },
        { code: 'await jobs.trigger("cleanup2");' },
        // Dynamic names are out of static reach.
        { code: 'await jobs.trigger(name);' },
    ],
});
