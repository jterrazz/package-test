import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

// The bin path hoisted into a const — the idiom real specs use.
const BIN = resolve(import.meta.dirname, '../../node_modules/.bin/oxlint');

export const { cleanup, cli } = await specification.cli(BIN);

afterAll(cleanup);
