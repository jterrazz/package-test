import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { triggerNameIsKebabCase } from './trigger-name-is-kebab-case.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('trigger-name-is-kebab-case', triggerNameIsKebabCase as unknown as OxlintRule, {
    invalid: [
        { code: 'await job.trigger("NightlyReport");', errors: 1 },
        { code: 'await job.trigger("nightly_report");', errors: 1 },
        { code: 'await job.trigger("nightly report");', errors: 1 },
        { code: 'await job.trigger("nightly--report");', errors: 1 },
    ],
    valid: [
        { code: 'await job.trigger("nightly-report");' },
        { code: 'await job.trigger("send-welcome-emails");' },
        { code: 'await job.trigger("cleanup2");' },
        // Dynamic names are out of static reach.
        { code: 'await job.trigger(name);' },
    ],
});
