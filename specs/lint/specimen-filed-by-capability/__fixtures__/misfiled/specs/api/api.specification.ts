import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

import { createApp } from './__fixtures__/specimen-api/app.js';

export const { api, cleanup } = await specification.api({ server: () => createApp() });

afterAll(cleanup);
