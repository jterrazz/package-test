import { definePreset } from '@jterrazz/typescript/rules';
import { afterAll } from 'vitest';

import { test as testPreset } from '../../dist/config.js';
import { sourceRootHoldsKnownEntries } from '../../dist/self-oxlint.js';
import { specification } from '../../src/index.js';

/** The `test()` preset and the name rule this package holds its own tree to: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    presets: [
        testPreset(),
        definePreset({
            name: 'self',
            names: [sourceRootHoldsKnownEntries],
            package: '@jterrazz/test',
        }),
    ],
});

afterAll(cleanup);
