import { ruleTester } from '@jterrazz/test';

import { specNamedForItsAspect } from '../spec-named-for-its-aspect.js';

ruleTester().run('spec-named-for-its-aspect', specNamedForItsAspect, {
    invalid: [
        // invariant: each catch-all name the convention lists answers no question.
        ...['basic', 'edge-cases', 'general', 'main', 'misc', 'more', 'other', 'tests'].map(
            (aspect) => ({
                code: '',
                errors: [{ column: 0, line: 1, messageId: 'generic' }],
                filename: `/repo/specs/api/events/list/${aspect}.spec.ts`,
            }),
        ),
        {
            name: 'An aspect is kebab-case, and the message spells the one to write.',
            code: '',
            errors: [
                { column: 0, line: 1, message: /fix: rename the file `not-found\.spec\.ts`/u },
            ],
            filename: '/repo/specs/api/events/get/notFound.spec.ts',
        },
        {
            name: 'Runs of marks become one hyphen, and none at either end.',
            code: '',
            errors: [
                { column: 0, line: 1, message: /fix: rename the file `not-found\.spec\.ts`/u },
            ],
            filename: '/repo/specs/api/events/get/_not__Found_.spec.ts',
        },
    ],
    valid: [
        { code: '', filename: '/repo/specs/api/events/list/pagination.spec.ts' },
        { code: '', filename: '/repo/specs/api/events/get/not-found.spec.ts' },
        {
            name: "The rule reads a spec's name, never a module test's.",
            code: '',
            filename: '/repo/src/misc.test.ts',
        },
    ],
});
