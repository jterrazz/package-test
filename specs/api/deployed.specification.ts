import { specification } from '@jterrazz/test';
import { readFileSync } from 'node:fs';
import { afterAll } from 'vitest';

import { serveSpecimen } from './__fixtures__/specimen-api-deployed/server.js';

/** The deployed api, answering in this process: no request leaves the machine. */
export const specimen = await serveSpecimen();

export const { api, cleanup } = await specification.api({
    ca: readFileSync(
        new URL('__fixtures__/specimen-api-deployed/certificates/ca.pem', import.meta.url),
        'utf8',
    ),
    timeout: 1000,
    url: specimen.plain,
});

afterAll(async () => {
    await cleanup();
    await specimen.close();
});
