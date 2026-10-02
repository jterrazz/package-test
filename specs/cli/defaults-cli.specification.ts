import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const CLI_BIN = resolve(import.meta.dirname, './_fixtures/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    defaults: { EXTRA: 'from-defaults', MY_VAR: 'from-defaults' },
});

afterAll(cleanup);
