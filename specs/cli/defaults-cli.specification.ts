import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const CLI_BIN = resolve(import.meta.dirname, '../_fixtures/cli-app/cli.sh');

/**
 * A runner with `defaults`: the environment every run of this binary starts
 * with. What the product needs to be deterministic at all is stated ONCE per
 * app rather than repeated on every chain and in every document.
 */
export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    defaults: { EXTRA: 'from-defaults', MY_VAR: 'from-defaults' },
});

afterAll(cleanup);
