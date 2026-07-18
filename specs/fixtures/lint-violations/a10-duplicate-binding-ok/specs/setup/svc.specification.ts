import { afterAll } from 'vitest';

import { postgres, redis, specification } from '@jterrazz/test';
import { createApp } from '../fixtures/app.js';

export const { api, cleanup } = await specification.api({
    server: () => createApp(),
    services: {
        cache: redis(),
        db: postgres(),
    },
});

afterAll(cleanup);
