import { ruleTester } from '@jterrazz/test';
import { resolve } from 'node:path';

import { includePointsAtAFolder } from '../include-points-at-a-folder.js';

// invariant: placed at this package's own root: `specs/api` exists here and `specs/lint2`
// does not, so the probe answers against a real tree.
const ROOT = resolve(import.meta.dirname, '../../../../..');
const CONFIG = resolve(ROOT, 'jterrazz.config.ts');

ruleTester().run('include-points-at-a-folder', includePointsAtAFolder, {
    invalid: [
        {
            code: `export default defineConfig({ test: { projects: { lint: { include: ['specs/lint2/**/*.test.ts'], reason: 'its tree' } } } });`,
            errors: [{ column: 68, line: 1, messageId: 'missingPrefix' }],
            filename: CONFIG,
        },
        {
            name: 'The folder is there and the suite is not: the suffix moved (`.test.ts` → `.spec.ts`) and the glob stayed behind.',
            code: `export default defineConfig({ test: { projects: { api: { include: ['specs/api/**/*.test.ts'], reason: 'its tree' } } } });`,
            errors: [{ column: 67, line: 1, messageId: 'collectsNothing' }],
            filename: CONFIG,
        },
    ],
    valid: [
        {
            name: 'A file that is no config is not read.',
            code: `export default defineConfig({ test: { projects: { lint: { include: ['specs/lint2/**/*.test.ts'], reason: 'its tree' } } } });`,
            filename: resolve(ROOT, 'src/config.ts'),
        },
        {
            code: `export default defineConfig({ test: { projects: { api: { include: ['specs/api/**/*.spec.ts'], reason: 'its tree' } } } });`,
            filename: CONFIG,
        },
        {
            name: "A glob with no static prefix collects from the config's own directory.",
            code: `export default defineConfig({ test: { projects: { unit: { include: ['**/*.test.ts'], reason: 'its tree' } } } });`,
            filename: CONFIG,
        },
    ],
});
