/**
 * CLI runner with a sqlite service — exercises SQL seeds (`.seed()`) against a
 * database while file state is handled separately by `.fixture()` (CONVENTIONS
 * B2/B6).
 */
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification, sqlite } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, '../fixtures/cli-app/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    services: { db: sqlite() },
});

afterAll(cleanup);
