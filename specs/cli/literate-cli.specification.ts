import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

/** A document names its ground by word (`env`, `serve`); how that ground is built stays here, once. */
const CLI_BIN = resolve(import.meta.dirname, './__fixtures__/specimen-cli/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    env: {
        frozen: { MY_VAR: 'from-the-frozen-set', TZ: 'UTC' },
    },
    // invariant: a served command runs from the project root, so the server's own folder is stated.
    root: './__fixtures__/specimen-cli-literate',
    serve: {
        echo: {
            command: 'node server.mjs',
            env: 'LITERATE_BACKEND_URL',
            ready: /listening on port (?<port>\d+)/u,
            url: (port) => `http://127.0.0.1:${port}/`,
        },
    },
});

afterAll(cleanup);
