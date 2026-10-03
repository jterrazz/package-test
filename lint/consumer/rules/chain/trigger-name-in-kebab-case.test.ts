import { ruleTester } from '@jterrazz/test';

import { triggerNameInKebabCase } from './trigger-name-in-kebab-case.js';

ruleTester().run('trigger-name-in-kebab-case', triggerNameInKebabCase, {
    invalid: [
        {
            code: 'await job.trigger("NightlyReport");',
            errors: [{ column: 18, line: 1, message: /rename the job "nightly-report"/u }],
        },
        {
            code: 'await job.trigger("nightly_report");',
            errors: [{ column: 18, line: 1, message: /rename the job "nightly-report"/u }],
        },
        {
            code: 'await job.trigger("nightly report");',
            errors: [{ column: 18, line: 1, message: /rename the job "nightly-report"/u }],
        },
        {
            code: 'await job.trigger("nightly--report");',
            errors: [{ column: 18, line: 1, message: /rename the job "nightly-report"/u }],
        },
        {
            name: 'What no kebab name holds — a dot, an edge, a run of marks — becomes one hyphen, and none at either end.',
            code: 'await job.trigger("-Nightly.. Report!-");',
            errors: [{ column: 18, line: 1, message: /rename the job "nightly-report"/u }],
        },
    ],
    valid: [
        { name: 'Another method is no trigger.', code: 'await job.run("NightlyReport");' },
        { code: 'await job.trigger("nightly-report");' },
        { code: 'await job.trigger("send-welcome-emails");' },
        { code: 'await job.trigger("cleanup2");' },
        { name: 'Dynamic names are out of static reach.', code: 'await job.trigger(name);' },
    ],
});
