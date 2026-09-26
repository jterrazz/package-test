import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { c32AspectName } from './spec-named-for-its-aspect.js';

ruleTester().run('c32-aspect-name', asOxlintRule(c32AspectName), {
    invalid: [
        // Each catch-all name the convention lists answers no question.
        ...['basic', 'edge-cases', 'general', 'main', 'misc', 'more', 'other', 'tests'].map(
            (aspect) => ({
                code: '',
                errors: [{ messageId: 'generic' }],
                filename: `/repo/specs/api/events/list/${aspect}.spec.ts`,
            }),
        ),
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
