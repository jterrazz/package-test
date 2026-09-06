import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

const BIN = resolve(import.meta.dirname, '../../bin/product.sh');

export const { cleanup, cli } = await specification.cli(BIN);

afterAll(cleanup);
