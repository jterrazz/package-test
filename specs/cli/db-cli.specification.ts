/** Declares the commands its specs run, so the checker files each spec under them (`spec-in-subject-folder`). */
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification, sqlite } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, '../_shared/_fixtures/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    commands: ['env', 'help'],
    services: { db: sqlite() },
});

afterAll(cleanup);
