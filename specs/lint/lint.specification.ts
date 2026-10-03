import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { selfPluginRules } from '../../.artifacts/dev/self-oxlint.js';
import { recommendedRules } from '../../dist/oxlint.js';

/** The two plugins as they ship, every rule on: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    config: {
        categories: { correctness: 'off' },
        rules: { ...recommendedRules, ...selfPluginRules },
    },
    plugins: ['../../dist/oxlint.js', '../../.artifacts/dev/self-oxlint.js'],
});

afterAll(cleanup);
