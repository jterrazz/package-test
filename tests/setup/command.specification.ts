import { resolve } from 'node:path';

import { command, spec } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, './fixtures/cli-app/cli.sh');

export const cliSpec = await spec(command(CLI_BIN), { root: './fixtures' });
