import { specification } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';
import { afterAll } from 'vitest';

export const { cleanup, integration } = await specification.integration({
    root: '../__fixtures__/specimen-api',
    services: { db: postgres() },
});

afterAll(cleanup);
