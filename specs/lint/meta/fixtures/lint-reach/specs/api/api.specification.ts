import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { app } from '../../src/app.js';

// The alias A3 refuses — a rule that reaches every file.
export const { api: myApi, cleanup } = await specification.api({ server: () => app });

afterAll(cleanup);
