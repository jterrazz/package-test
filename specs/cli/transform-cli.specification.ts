import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/** ANSI is stripped by default: this runner observes the transform mechanism itself (`.raw` untouched, the golden never transformed). */
const CLI_BIN = resolve(import.meta.dirname, '../shared/fixtures/specimen-cli/cli.sh');

const stripAnsi = (text: string): string => text.replaceAll(/\u001B\[[0-9;]*m/gu, '');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    transform: stripAnsi,
});

afterAll(cleanup);
