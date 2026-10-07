import { ruleTester } from '@jterrazz/test';
import { resolve } from 'node:path';

import { stubDataHasABuilder } from '../stub-data-has-a-builder.js';

const SPECS_LINT = resolve(import.meta.dirname, '../../../../../specs/lint');

const COMPLIANT = `${SPECS_LINT}/stub-data-has-a-builder/__fixtures__/compliant/specs/app/widget/__setup__/stubs`;

const VIOLATION = `${SPECS_LINT}/stub-data-has-a-builder/__fixtures__/violation/specs/app/widget/__setup__/stubs`;

ruleTester().run('stub-data-has-a-builder', stubDataHasABuilder, {
    invalid: [
        {
            code: "export const path = '/articles';",
            errors: [{ column: 0, line: 1, messageId: 'orphan' }],
            filename: `${VIOLATION}/http/articles.request.ts`,
        },
    ],
    valid: [
        {
            name: 'Request data outside a stubs folder is no unit’s.',
            code: "export const path = '/articles';",
            filename: `${SPECS_LINT}/stub-data-has-a-builder/__fixtures__/violation/specs/app/widget/__setup__/mocks/http/articles.request.ts`,
        },
        {
            code: "export const prompt = 'Classify: hats';",
            filename: `${COMPLIANT}/openai/classify.request.ts`,
        },
        {
            code: "export const prompt = 'Classify: hats';",
            filename: `${COMPLIANT}/grpc/classify.request.ts`,
        },
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/stub-data-has-a-builder/__fixtures__/compliant/specs/app/widget/widget.test.ts`,
        },
        {
            code: "export const path = '/articles';",
            filename: '/repo/src/stubs/http/articles.request.ts',
        },
    ],
});
