import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/** Registers `dist/oxlint.js` as a JS plugin of the real oxlint: `npm run build` first. */
const LINT_BIN = resolve(import.meta.dirname, '../_shared/_fixtures/lint-cli/lint.sh');

export const { cleanup, cli } = await specification.cli(LINT_BIN);

afterAll(cleanup);
