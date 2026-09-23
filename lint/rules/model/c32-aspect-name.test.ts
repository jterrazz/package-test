import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { c32AspectName } from './c32-aspect-name.js';

ruleTester().run('c32-aspect-name', asOxlintRule(c32AspectName), {
    invalid: [
        // A catch-all name answers no question.
        {
            code: '',
            errors: [{ messageId: 'generic' }],
            filename: '/repo/specs/api/events/list/misc.spec.ts',
        },
        {
            code: '',
            errors: [{ messageId: 'generic' }],
            filename: '/repo/specs/api/events/list/edge-cases.spec.ts',
        },
        // An aspect is kebab-case, and the message spells the one to write.
        {
            code: '',
            errors: [{ message: /fix: rename the file `not-found\.spec\.ts`/u }],
            filename: '/repo/specs/api/events/get/notFound.spec.ts',
        },
    ],
    valid: [
        { code: '', filename: '/repo/specs/api/events/list/pagination.spec.ts' },
        { code: '', filename: '/repo/specs/api/events/get/not-found.spec.ts' },
        // The rule reads a spec's name, never a module test's.
        { code: '', filename: '/repo/src/misc.test.ts' },
    ],
});
