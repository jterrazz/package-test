import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, cli } = await specification.cli('./bin/report.js');

afterAll(cleanup);
