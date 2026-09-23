import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, url, website } = await specification.website({
    server: {
        command: 'node specs/fixtures/website-app/server.mjs',
        ready: /listening on port (?<port>\d+)/u,
    },
});

afterAll(cleanup);
