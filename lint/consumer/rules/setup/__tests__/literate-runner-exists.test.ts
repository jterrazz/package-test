import { ruleTester } from '@jterrazz/test';
import { resolve } from 'node:path';

import { literateRunnerExists } from '../literate-runner-exists.js';

// invariant: placed at this package's own root, where `specs/cli/cli.specification.ts` exists
// and `specs/cli/gone.specification.ts` does not, so the stat answers against a real tree.
const ROOT = resolve(import.meta.dirname, '../../../../..');
const CONFIG = resolve(ROOT, 'studio.config.ts');

const configNaming = (path: string): string =>
    `export default defineConfig({ test: { projects: { cli: { literate: { runner: '${path}' }, reason: 'the documents' } } } });`;

ruleTester().run('literate-runner-exists', literateRunnerExists, {
    invalid: [
        {
            code: configNaming('./specs/cli/gone.specification.ts'),
            errors: [
                {
                    column: 69,
                    data: { path: './specs/cli/gone.specification.ts' },
                    line: 1,
                    messageId: 'missing',
                },
            ],
            filename: CONFIG,
        },
    ],
    valid: [
        {
            name: 'A file that is no config is not read.',
            code: configNaming('./specs/cli/gone.specification.ts'),
            filename: resolve(ROOT, 'src/config.ts'),
        },
        {
            code: configNaming('./specs/cli/cli.specification.ts'),
            filename: CONFIG,
        },
    ],
});
