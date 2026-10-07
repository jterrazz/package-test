import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

export const { api, cleanup } = await specification.api({ server: () => ({ request: () => new Response('{}') }) });

afterAll(cleanup);
