import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { GO_CLI_BIN } from './__setup__/go/per-run.js';

export const { cleanup, cli } = await specification.cli(GO_CLI_BIN);

afterAll(cleanup);
