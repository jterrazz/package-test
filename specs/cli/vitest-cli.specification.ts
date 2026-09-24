/**
 * This checkout's vitest as the binary under test — the runner update mode is
 * specified through: a scratch test laid in the working directory, run the
 * way a consumer runs its suite, rewritten in place.
 */
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const VITEST_BIN = resolve(import.meta.dirname, '../shared/fixtures/vitest-cli/vitest.sh');

export const { cleanup, cli } = await specification.cli(VITEST_BIN);

afterAll(cleanup);
