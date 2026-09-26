import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/** The transform strips " plain" from the actual output only, never from the golden. */
const CLI_BIN = resolve(import.meta.dirname, './_fixtures/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    transform: (text) => text.replaceAll(' plain', ''),
});

afterAll(cleanup);
