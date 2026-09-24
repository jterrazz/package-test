import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

import { binary } from './shared/fixtures/binary/binary.js';

export const { cleanup, cli } = await specification.cli(binary());

afterAll(cleanup);
