import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'api',
    platform: 'node',
    presets: [test()],
    test: { projects: [{ specification: 'cli' }] },
    typescript: {
        knip: {
            entry: {
                'specs/cli/cli.specification.ts':
                    'the literate documents bind it by convention, which knip cannot trace',
            },
        },
    },
});
