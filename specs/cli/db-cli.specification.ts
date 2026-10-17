import { specification } from '@jterrazz/test';
import { sqlite } from '@jterrazz/test/services';
// invariant: declares the commands its specs run, so the checker files each spec under them (`spec-in-subject-folder`).
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const CLI_BIN = resolve(import.meta.dirname, './__fixtures__/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    commands: ['env', 'help'],
    services: { db: sqlite() },
});

afterAll(cleanup);
