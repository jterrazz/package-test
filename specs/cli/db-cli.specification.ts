import { specification, sqlite } from '@jterrazz/test';
// invariant: declares the commands its specs run, so the checker files each spec under them (`spec-in-subject-folder`).
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const CLI_BIN = resolve(import.meta.dirname, './__fixtures__/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    commands: ['env', 'help'],
    services: { db: sqlite() },
});

afterAll(cleanup);
