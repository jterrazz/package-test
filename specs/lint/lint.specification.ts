import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { recommendedRules } from '../../dist/oxlint.js';
import { selfPluginRules } from '../../dist/self-oxlint.js';

/** The two plugins as they ship, every rule on: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    config: {
        categories: { correctness: 'off' },
        rules: { ...recommendedRules, ...selfPluginRules },
    },
    plugins: ['../../dist/oxlint.js', '../../dist/self-oxlint.js'],
});

afterAll(cleanup);
