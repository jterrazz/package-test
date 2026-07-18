import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/**
 * CLI runner whose `transform` strips the word " plain" from the output —
 * used by specs/cli/assertions to prove the transform is ASYMMETRIC: it runs
 * on the actual output only, never on the expected/ fixture.
 */
const CLI_BIN = resolve(import.meta.dirname, '../fixtures/cli-app/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    transform: (text) => text.replace(/ plain/g, ''),
});

afterAll(cleanup);
