import { resolve } from 'node:path';

import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { e7wIncludePrefixExists } from './e7w-include-prefix-exists.js';

// Placed at this package's own root: `specs/api` exists here and `specs/lint2`
// Does not, so the probe answers against a real tree.
const ROOT = resolve(import.meta.dirname, '../../../..');
const CONFIG = resolve(ROOT, 'vitest.config.ts');

ruleTester().run('e7w-include-prefix-exists', asOxlintRule(e7wIncludePrefixExists), {
    invalid: [
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'lint', include: ['specs/lint2/**/*.test.ts'] }] } });`,
            errors: [{ messageId: 'missingPrefix' }],
            filename: CONFIG,
        },
        // The folder is there and the suite is not: the suffix moved
        // (`.test.ts` → `.spec.ts`) and the glob stayed behind.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'api', include: ['specs/api/**/*.test.ts'] }] } });`,
            errors: [{ messageId: 'collectsNothing' }],
            filename: CONFIG,
        },
    ],
    valid: [
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'api', include: ['specs/api/**/*.spec.ts'] }] } });`,
            filename: CONFIG,
        },
        // A glob with no static prefix collects from the config's own directory.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'unit', include: ['**/*.test.ts'] }] } });`,
            filename: CONFIG,
        },
    ],
});
