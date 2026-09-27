import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const REPOSITORY = resolve(import.meta.dirname, '../..');

/** The passes only this package runs on itself: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    checkers: [`node ${REPOSITORY}/dist/self.js check`],
});

afterAll(cleanup);
