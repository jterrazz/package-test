import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/**
 * The runner for a site that talks to an API: a declared stub backend whose
 * URL the server is started with, the project root moved to the site's own
 * folder (the command is the site's, run where the site lives), and the
 * cross-origin policy opened — a local server blocks by default.
 */
export const { cleanup, website } = await specification.website({
    backend: { env: 'API_URL' },
    external: 'allow',
    root: '../fixtures/website-app',
    server: { command: 'node server.mjs', ready: '/' },
});

afterAll(cleanup);
