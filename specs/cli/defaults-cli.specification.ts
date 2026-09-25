import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, '../shared/fixtures/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    defaults: { EXTRA: 'from-defaults', MY_VAR: 'from-defaults' },
});

afterAll(cleanup);
