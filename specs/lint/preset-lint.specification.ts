import { afterAll } from 'vitest';

import { test as testPreset } from '../../dist/config.js';
import { specification } from '../../src/index.js';

/** The laws the `test()` preset hands the toolchain: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({ presets: [testPreset()] });

afterAll(cleanup);
