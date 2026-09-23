import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

export const { app, cleanup } = await specification.app({});

afterAll(cleanup);
