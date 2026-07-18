import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';
import { createApp } from '../fixtures/app.js';

export const { api, cleanup } = await specification.api({
    server: () => createApp(),
});

afterAll(cleanup);
