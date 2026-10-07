import { ruleTester } from '@jterrazz/test';

import { runnerInSpecificationFile } from '../runner-in-specification-file.js';

const CALL = 'export const { api } = await specification.api({});';

ruleTester().run('runner-in-specification-file', runnerInSpecificationFile, {
    invalid: [
        {
            name: 'A runner built in a spec is refused, naming its member.',
            code: CALL,
            errors: [
                {
                    column: 29,
                    line: 1,
                    message:
                        /^found: `specification\.api\(\)` called outside a `\*\.specification\.ts` file · .* fix: move the call into `specs\/api\/api\.specification\.ts`/u,
                },
            ],
            filename: '/repo/specs/api/orders/list.spec.ts',
        },
        {
            name: 'A file named like a specification, without its extension, is no specification.',
            code: CALL,
            errors: [{ column: 29, line: 1, messageId: 'outsideSpecification' }],
            filename: '/repo/specs/api/api.specification.helpers.ts',
        },
    ],
    valid: [
        { code: CALL, filename: '/repo/specs/api/api.specification.ts' },
        { code: CALL, filename: '/repo/specs/component/app.specification.tsx' },
        { code: CALL, filename: '/repo/specs/component/intercept/table.test.tsx' },
        {
            code: "await other.api({});\nconst note = 'specification.api';",
            filename: '/repo/specs/api/orders/list.spec.ts',
        },
    ],
});
