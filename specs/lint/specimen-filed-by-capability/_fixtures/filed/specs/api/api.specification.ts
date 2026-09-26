import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

import { createApp } from '../_shared/_fixtures/specimen-api/app.js';

export const { api, cleanup } = await specification.api({ server: () => createApp() });

afterAll(cleanup);
