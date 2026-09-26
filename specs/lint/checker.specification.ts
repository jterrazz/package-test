import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/** Runs `dist/checker.js`: `npm run build` first. */
const CHECKER_BIN = resolve(import.meta.dirname, './_fixtures/checker-cli/check.sh');

export const { cleanup, cli } = await specification.cli(CHECKER_BIN);

afterAll(cleanup);
