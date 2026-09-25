import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const VITEST_BIN = resolve(import.meta.dirname, '../shared/fixtures/specimen-cli-vitest/vitest.sh');

export const { cleanup, cli } = await specification.cli(VITEST_BIN);

afterAll(cleanup);
