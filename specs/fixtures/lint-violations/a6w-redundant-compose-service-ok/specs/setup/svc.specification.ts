import { afterAll } from 'vitest';

import { postgres, specification } from '@jterrazz/test';
import { createApp } from '../fixtures/app.js';

export const { api, cleanup } = await specification.api({
    server: () => createApp(),
    services: {
        events: postgres({ composeService: 'legacy_event_store' }),
    },
});

afterAll(cleanup);
