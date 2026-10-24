import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { specimen } from './deployed.specification.js';

/** A fresh golden records the headers this deployed api's probes are about. */
export const { api, cleanup } = await specification.api({
    recordedHeaders: ['content-type', 'x-frame-options'],
    url: specimen.plain,
});

afterAll(cleanup);
