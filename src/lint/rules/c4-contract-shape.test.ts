import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c4ContractShape } from './c4-contract-shape.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const CONTRACT = '/repo/specs/api/feature/contracts/latest.http.ts';

ruleTester.run('c4-contract-shape', c4ContractShape as unknown as OxlintRule, {
    invalid: [
        // Unknown provider suffix.
        {
            code: `import { defineContract } from '@jterrazz/test';\nexport default defineContract({});`,
            errors: [{ messageId: 'badName' }],
            filename: '/repo/specs/api/feature/contracts/latest.grpc.ts',
        },
        // Nested under a subfolder.
        {
            code: `import { defineContract } from '@jterrazz/test';\nexport default defineContract({});`,
            errors: [{ messageId: 'subfolder' }],
            filename: '/repo/specs/api/feature/contracts/sub/latest.http.ts',
        },
        // A named export alongside the default.
        {
            code: `import { defineContract } from '@jterrazz/test';\nexport const extra = 1;\nexport default defineContract({});`,
            errors: [{ messageId: 'namedExport' }],
            filename: CONTRACT,
        },
        // Import from something other than the public entry.
        {
            code: `import { thing } from '../helpers.js';\nimport { defineContract } from '@jterrazz/test';\nexport default defineContract({});`,
            errors: [{ messageId: 'foreignImport' }],
            filename: CONTRACT,
        },
        // Default export is not defineContract(...).
        {
            code: `export default { trigger: 1 };`,
            errors: [{ messageId: 'notDefineContract' }],
            filename: CONTRACT,
        },
        // No default export at all.
        {
            code: `import { defineContract } from '@jterrazz/test';\nconst c = defineContract({});`,
            errors: [{ messageId: 'missingDefault' }],
            filename: CONTRACT,
        },
    ],
    valid: [
        // The canonical shape.
        {
            code: `import { defineContract, http } from '@jterrazz/test';\nexport default defineContract({ trigger: http.get('u'), response: http.json({}) });`,
            filename: CONTRACT,
        },
        // Not a contract file — rule inert.
        {
            code: `export const x = 1;\nexport const y = 2;`,
            filename: '/repo/specs/api/feature/feature.test.ts',
        },
    ],
});
