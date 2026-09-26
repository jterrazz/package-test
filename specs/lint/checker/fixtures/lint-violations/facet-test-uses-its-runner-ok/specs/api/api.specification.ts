import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { app } from '../../src/app.js';

export const { api, cleanup } = await specification.api({ server: () => app });

afterAll(cleanup);
