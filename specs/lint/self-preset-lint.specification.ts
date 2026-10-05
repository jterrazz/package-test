import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { self } from '../../.artifacts/dev/preset.js';
import { test as testPreset } from '../../dist/config.js';

/** The `test()` preset and the self preset this package holds its own tree to: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({ presets: [testPreset(), self()] });

afterAll(cleanup);
