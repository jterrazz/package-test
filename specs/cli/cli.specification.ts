import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, '../fixtures/cli-app/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN);

afterAll(cleanup);
