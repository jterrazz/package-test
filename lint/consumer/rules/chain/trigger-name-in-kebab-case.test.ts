import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { triggerNameInKebabCase } from './trigger-name-in-kebab-case.js';

ruleTester().run('trigger-name-in-kebab-case', asOxlintRule(triggerNameInKebabCase), {
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
