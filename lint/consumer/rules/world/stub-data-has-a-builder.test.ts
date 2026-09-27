import { resolve } from 'node:path';

import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { stubDataHasABuilder } from './stub-data-has-a-builder.js';

const SPECS_LINT = resolve(import.meta.dirname, '../../../../specs/lint');

const COMPLIANT = `${SPECS_LINT}/stub-data-has-a-builder/_fixtures/compliant/specs/app/widget/_setup/stubs`;

const VIOLATION = `${SPECS_LINT}/stub-data-has-a-builder/_fixtures/violation/specs/app/widget/_setup/stubs`;

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
            code: "export const prompt = 'Classify: hats';",
            filename: `${COMPLIANT}/openai/classify.request.ts`,
        },
        {
            code: "export const prompt = 'Classify: hats';",
            filename: `${COMPLIANT}/grpc/classify.request.ts`,
        },
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/stub-data-has-a-builder/_fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        {
            code: "export const path = '/articles';",
            filename: '/repo/src/world/stubs/http/articles.request.ts',
        },
    ],
});
