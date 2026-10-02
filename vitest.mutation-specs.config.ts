import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';

import { defineSpecConfig } from './src/index.vitest.js';
import { nodeSpecs } from './vitest.config.js';
import { moduleTests, strykerTestNames } from './vitest.mutation.config.js';

const ACTIVE_MUTANT = {
    test: {
        setupFiles: [
            resolve(import.meta.dirname, 'specs/_shared/_setup/mutation/active-mutant.ts'),
        ],
    },
};

export default defineSpecConfig({
    test: {
        projects: [
            mergeConfig(moduleTests, ACTIVE_MUTANT),
            ...nodeSpecs.map((project) =>
                mergeConfig(project, { ...ACTIVE_MUTANT, plugins: [strykerTestNames] }),
            ),
        ],
    },
});
