import { afterAll } from 'vitest';

import { test as testPreset } from '../../dist/config.js';
import { self } from '../../dist/self-config.js';
import { specification } from '../../src/index.js';

/** The `test()` preset and the self preset this package holds its own tree to: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({ presets: [testPreset(), self()] });

afterAll(cleanup);
