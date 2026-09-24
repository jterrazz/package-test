/**
 * CLI runner with a sqlite service — exercises SQL seeds (`.seed()`) against a
 * database while file state is handled separately by `.fixture()` (CONVENTIONS
 * B2/B6). It declares the commands its specs run, so the checker files each
 * spec under them (C30).
 */
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification, sqlite } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, '../shared/fixtures/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    commands: ['env', 'help'],
    services: { db: sqlite() },
});

afterAll(cleanup);
