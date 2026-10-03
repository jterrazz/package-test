import { ruleTester } from '@jterrazz/test';
import { resolve } from 'node:path';

import { includePointsAtAFolder } from './include-points-at-a-folder.js';

// invariant: placed at this package's own root: `specs/api` exists here and `specs/lint2`
// does not, so the probe answers against a real tree.
const ROOT = resolve(import.meta.dirname, '../../../..');
const CONFIG = resolve(ROOT, 'jterrazz.config.ts');

ruleTester().run('include-points-at-a-folder', includePointsAtAFolder, {
    invalid: [
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'lint', include: ['specs/lint2/**/*.test.ts'] }] } });`,
            errors: [{ column: 79, line: 1, messageId: 'missingPrefix' }],
            filename: CONFIG,
        },
        {
            name: 'The folder is there and the suite is not: the suffix moved (`.test.ts` → `.spec.ts`) and the glob stayed behind.',
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'api', include: ['specs/api/**/*.test.ts'] }] } });`,
            errors: [{ column: 78, line: 1, messageId: 'collectsNothing' }],
            filename: CONFIG,
        },
    ],
    valid: [
        {
            name: 'A file that is no config is not read.',
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'lint', include: ['specs/lint2/**/*.test.ts'] }] } });`,
            filename: resolve(ROOT, 'src/config.ts'),
        },
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'api', include: ['specs/api/**/*.spec.ts'] }] } });`,
            filename: CONFIG,
        },
        {
            name: "A glob with no static prefix collects from the config's own directory.",
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'unit', include: ['**/*.test.ts'] }] } });`,
            filename: CONFIG,
        },
    ],
});
