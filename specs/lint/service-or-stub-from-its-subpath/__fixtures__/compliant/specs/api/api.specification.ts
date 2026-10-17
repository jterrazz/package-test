import { specification } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';
import { http } from '@jterrazz/test/stubs';
import { afterAll } from 'vitest';

export const { api, cleanup } = await specification.api({
    server: () => ({ request: () => new Response('ok') }),
    services: { db: postgres() },
});

export const never = http.never(http.get('/admin'));

afterAll(cleanup);
