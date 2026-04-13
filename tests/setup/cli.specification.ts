import { resolve } from 'node:path';

import { cli } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, './fixtures/cli-app/cli.sh');

export const cliSpec = await cli({
    command: CLI_BIN,
    root: './fixtures',
});
