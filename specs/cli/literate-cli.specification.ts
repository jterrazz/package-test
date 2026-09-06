import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/**
 * The runner the literate `<case>.cli` specs are bound to — the one the
 * `literate()` plugin names in `vitest.config.ts`, and the one
 * `specs/cli/literate/literate.test.ts` drives through the `cli.run()` bridge.
 *
 * It declares the two registries a `.cli` header names by WORD: `env` (named
 * environment sets) and `serve` (named servers). A scenario file states WHICH
 * ground it stands on; how that ground is built stays in code, once.
 */
const CLI_BIN = resolve(import.meta.dirname, '../fixtures/cli-app/cli.sh');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    env: {
        frozen: { MY_VAR: 'from-the-frozen-set', TZ: 'UTC' },
    },
    serve: {
        echo: {
            command: 'node specs/fixtures/literate-server/server.mjs',
            env: 'LITERATE_BACKEND_URL',
            ready: /listening on port (?<port>\d+)/,
            url: (port) => `http://127.0.0.1:${port}/`,
        },
    },
});

afterAll(cleanup);
