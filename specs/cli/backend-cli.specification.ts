import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const CLI_BIN = resolve(import.meta.dirname, './__fixtures__/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    backend: { env: 'INGEST_URL' },
});

afterAll(cleanup);
