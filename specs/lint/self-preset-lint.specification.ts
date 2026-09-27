import { afterAll } from 'vitest';

import { test as testPreset } from '../../dist/config.js';
import { sourceRootHoldsKnownEntries } from '../../dist/self-oxlint.js';
import { specification } from '../../src/index.js';

/** The `test()` preset and the name rule this package adds to its own tree: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    presets: [testPreset()],
    settings: { typescript: { names: [sourceRootHoldsKnownEntries] } },
});

afterAll(cleanup);
