import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/**
 * E2E runner for the oxlint plugin layer (src/lint/): the binary is a thin
 * wrapper around the real oxlint, with dist/oxlint.js registered as a JS
 * plugin. Specs copy violation fixtures into the cwd and lint them for real.
 * Requires `npm run build` first (the plugin loads from dist/).
 */
const LINT_BIN = resolve(import.meta.dirname, '../fixtures/lint-cli/lint.sh');

export const { cleanup, cli } = await specification.cli(LINT_BIN);

afterAll(cleanup);
