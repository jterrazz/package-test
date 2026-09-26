import { afterAll } from 'vitest';

import { postgres, specification } from '../../src/index.js';

export const { cleanup, integration } = await specification.integration({
    root: '../_shared/_fixtures/specimen-api',
    services: { db: postgres() },
});

afterAll(cleanup);
