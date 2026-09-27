import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { triggerNameInKebabCase } from './trigger-name-in-kebab-case.js';

ruleTester().run('trigger-name-in-kebab-case', triggerNameInKebabCase, {
    invalid: [
        {
            code: 'await job.trigger("NightlyReport");',
            errors: [{ column: 18, line: 1, messageId: 'notKebab' }],
        },
        {
            code: 'await job.trigger("nightly_report");',
            errors: [{ column: 18, line: 1, messageId: 'notKebab' }],
        },
        {
            code: 'await job.trigger("nightly report");',
            errors: [{ column: 18, line: 1, messageId: 'notKebab' }],
        },
        {
            code: 'await job.trigger("nightly--report");',
            errors: [{ column: 18, line: 1, messageId: 'notKebab' }],
        },
    ],
    valid: [
        { code: 'await job.trigger("nightly-report");' },
        { code: 'await job.trigger("send-welcome-emails");' },
        { code: 'await job.trigger("cleanup2");' },
        // Dynamic names are out of static reach.
        { code: 'await job.trigger(name);' },
    ],
});
