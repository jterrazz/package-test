import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const VITEST_BIN = resolve(import.meta.dirname, './__fixtures__/specimen-cli-vitest/vitest.sh');

export const { cleanup, cli } = await specification.cli(VITEST_BIN);

afterAll(cleanup);
