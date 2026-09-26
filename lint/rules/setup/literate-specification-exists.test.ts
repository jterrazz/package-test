import { resolve } from 'node:path';

import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { e8LiterateSpecificationExists } from './literate-specification-exists.js';

// The config sits at this package's root: the rule answers against its real specification files.
const ROOT = resolve(import.meta.dirname, '../../..');
const CONFIG = resolve(ROOT, 'vitest.config.ts');

ruleTester().run('e8-literate-specification-exists', asOxlintRule(e8LiterateSpecificationExists), {
    invalid: [
        // The top-level door, and the node its missing path is written on.
        {
            code: `export default defineSpecConfig({\n    literate: { specification: './specs/nowhere.specification.ts' },\n});`,
            errors: [{ column: 16, line: 2, messageId: 'missing' }],
            filename: CONFIG,
        },
        {
            code: `export default defineSpecConfig({ test: { projects: [cli({ literate: { specification: './specs/cli/nowhere.specification.ts' } })] } });`,
            errors: [{ messageId: 'missing' }],
            filename: CONFIG,
        },
    ],
    valid: [
        {
            code: `export default defineSpecConfig({ test: { projects: [cli({ literate: { specification: './specs/cli/literate-cli.specification.ts' } })] } });`,
            filename: CONFIG,
        },
        // No literate door at all.
        {
            code: `export default defineSpecConfig({ test: { projects: [cli()] } });`,
            filename: CONFIG,
        },
    ],
});
