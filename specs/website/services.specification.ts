import { process as processService, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/**
 * The website runner started BESIDE another process: an API the site reads at
 * render time. `server` is a function of the started services, which is how
 * the site learns the URL of something the OS chose the port for.
 */
export const { cleanup, website } = await specification.website({
    server: ({ api }) =>
        processService({
            command: 'node specs/shared/fixtures/website-app/server.mjs',
            env: { API_URL: api.connectionString },
            ready: /listening on port (?<port>\d+)/u,
        }),
    services: {
        api: processService({
            command: 'node specs/shared/fixtures/api-app/server.mjs',
            ready: /listening on port (?<port>\d+)/u,
        }),
    },
});

afterAll(cleanup);
