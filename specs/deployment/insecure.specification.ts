import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { specimen } from './deployment.specification.js';

/** A certificate no authority signed, accepted on purpose: its facts still say why it is not trusted. */
export const { cleanup, deployment } = await specification.deployment({
    insecure: true,
    url: specimen.selfSigned,
});

afterAll(cleanup);
