import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, website } = await specification.website({
    server: { command: 'node specs/_fixtures/website-app/server.mjs', ready: '/' },
});
afterAll(cleanup);
