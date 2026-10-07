import { file, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const seedFile = file('./orders/__seeds__/orders.sql');

export const { api, cleanup } = await specification.api({ server: () => ({}) as never });

afterAll(cleanup);
