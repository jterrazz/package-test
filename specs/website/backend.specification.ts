import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/** The project root is the site's own folder, where its command runs, and cross-origin is opened: a local server blocks by default. */
export const { cleanup, website } = await specification.website({
    backend: { env: 'API_URL' },
    external: 'allow',
    root: './__fixtures__/specimen-website',
    server: { command: 'node server.mjs', ready: /listening on port (?<port>\d+)/u },
});

afterAll(cleanup);
