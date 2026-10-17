import { http, postgres, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { api, cleanup } = await specification.api({
    server: () => ({ request: () => new Response('ok') }),
    services: { db: postgres() },
});

export const never = http.never(http.get('/admin'));

afterAll(cleanup);
