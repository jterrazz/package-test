import { file, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const seedFile = file('./orders/seeds/orders.sql');

export const { api, cleanup } = await specification.api({ server: () => ({}) as never });

afterAll(cleanup);
