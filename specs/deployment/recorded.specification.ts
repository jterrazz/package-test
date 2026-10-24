import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { specimen } from './deployment.specification.js';

/** A fresh golden records the headers this deployment's probes are about. */
export const { cleanup, deployment } = await specification.deployment({
    recordedHeaders: ['content-type', 'x-frame-options'],
    url: specimen.plain,
});

afterAll(cleanup);
