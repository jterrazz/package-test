import { process as processService, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/**
 * The website runner started BESIDE another process: an API the site reads at
 * render time. `server` is a function of the started services, which is how
 * the site learns the URL of something the framework chose the port for.
 */
export const { cleanup, website } = await specification.website({
    server: ({ api }) =>
        processService({
            command: 'node specs/_fixtures/website-app/server.mjs',
            env: { API_URL: api.connectionString },
            ready: '/',
        }),
    services: {
        api: processService({
            command: 'node specs/_fixtures/api-app/server.mjs',
            ready: '/health',
        }),
    },
});

afterAll(cleanup);
