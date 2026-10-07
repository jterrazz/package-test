import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { api, cleanup } = await specification.api({ server: () => ({ request: () => new Response('ok') }) });

afterAll(cleanup);
