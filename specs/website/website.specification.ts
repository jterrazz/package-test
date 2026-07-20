import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, website } = await specification.website({
    server: { command: 'node specs/fixtures/website-app/server.mjs', ready: '/' },
});
afterAll(cleanup);
