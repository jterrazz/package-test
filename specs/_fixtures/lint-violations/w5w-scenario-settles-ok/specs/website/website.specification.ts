import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, website } = await specification.website({ url: 'http://localhost:3000' });

afterAll(cleanup);
