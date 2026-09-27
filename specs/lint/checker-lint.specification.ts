import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const REPOSITORY = resolve(import.meta.dirname, '../..');

/** The conventions checker as it ships: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    checkers: [`node ${REPOSITORY}/dist/checker.js`],
});

afterAll(cleanup);
