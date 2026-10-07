import { ruleTester } from '@jterrazz/test';
import { resolve } from 'node:path';

import { literateRunnerExists } from '../literate-runner-exists.js';

// invariant: placed at this package's own root, where `specs/cli/cli.specification.ts` exists
// and `specs/cli/gone.specification.ts` does not, so the stat answers against a real tree.
const ROOT = resolve(import.meta.dirname, '../../../../..');
const CONFIG = resolve(ROOT, 'jterrazz.config.ts');

const configNaming = (...paths: string[]): string =>
    `export default defineSpecConfig({ projects: [${paths
        .map((path) => `{ literate: { runner: '${path}' } }`)
        .join(', ')}] });`;

ruleTester().run('literate-runner-exists', literateRunnerExists, {
    invalid: [
        {
            code: configNaming(
                './specs/cli/cli.specification.ts',
                './specs/cli/gone.specification.ts',
            ),
            errors: [
                {
                    column: 121,
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
