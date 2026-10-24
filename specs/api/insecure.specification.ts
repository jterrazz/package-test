import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { specimen } from './deployed.specification.js';

/** A certificate no authority signed, accepted on purpose: its facts still say why it is not trusted. */
export const { api, cleanup } = await specification.api({
    insecure: true,
    url: specimen.selfSigned,
});

afterAll(cleanup);
