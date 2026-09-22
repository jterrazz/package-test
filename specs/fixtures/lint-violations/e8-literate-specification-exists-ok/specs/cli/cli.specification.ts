import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, cli } = await specification.cli('./bin/app.js');

afterAll(cleanup);
