import { afterAll } from 'vitest';

import { postgres, specification } from '@jterrazz/test';
import { createApp } from '../fixtures/app.js';

// Both keys derive the same compose service "analytics-db" (A10).
export const { api, cleanup } = await specification.api({
    server: () => createApp(),
    services: {
        analyticsDb: postgres(),
        'analytics-db': postgres(),
    },
});

afterAll(cleanup);
