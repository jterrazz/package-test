import { postgres, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, integration } = await specification.integration({
    root: '../__fixtures__/specimen-api',
    services: { db: postgres() },
});

afterAll(cleanup);
