import { process as processService, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/** `server` is a function of the started services: how the site learns a URL whose port the OS chose. */
export const { cleanup, website } = await specification.website({
    server: ({ api }) =>
        processService({
            command: 'node specs/shared/fixtures/specimen-website/server.mjs',
            env: { API_URL: api.connectionString },
            ready: /listening on port (?<port>\d+)/u,
        }),
    services: {
        api: processService({
            command: 'node specs/shared/fixtures/specimen-website-backend/server.mjs',
            ready: /listening on port (?<port>\d+)/u,
        }),
    },
});

afterAll(cleanup);
