import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { app } from '../../src/app.js';

// The alias A3 refuses — the one rule whose reach is the specification role.
export const { api: myApi, cleanup } = await specification.api({ server: () => app });

afterAll(cleanup);
