import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

export const { cleanup, cli } = await specification.cli('./bin.sh', { commands: ['db', 'migrate', 'seed'] });

afterAll(cleanup);
