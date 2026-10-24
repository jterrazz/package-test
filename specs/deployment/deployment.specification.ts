import { specification } from '@jterrazz/test';
import { readFileSync } from 'node:fs';
import { afterAll } from 'vitest';

import { serveSpecimen } from './__fixtures__/specimen-deployment/server.js';

/** The deployed edge, answering in this process: no exchange leaves the machine. */
export const specimen = await serveSpecimen();

export const { cleanup, deployment } = await specification.deployment({
    ca: readFileSync(
        new URL('__fixtures__/specimen-deployment/certificates/ca.pem', import.meta.url),
        'utf8',
    ),
    timeout: 1000,
    url: specimen.plain,
});

afterAll(async () => {
    await cleanup();
    await specimen.close();
});
